import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type { Storage } from './storage';

interface RecordingSession {
  id: number;
  streamId: number;
  process: ChildProcess;
  outputPath: string;
  startTime: Date;
  duration: number; // in minutes
  status: 'recording' | 'completed' | 'error';
}

export class DVRManager {
  private recordings: Map<number, RecordingSession> = new Map();
  private storage: Storage;
  private recordingsDir: string;

  constructor(storage: Storage, recordingsDir: string = './recordings') {
    this.storage = storage;
    this.recordingsDir = recordingsDir;
    this.ensureRecordingsDirectory();
  }

  private async ensureRecordingsDirectory() {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
      console.log(`[DVR] Recordings directory: ${this.recordingsDir}`);
    } catch (error) {
      console.error('[DVR] Failed to create recordings directory:', error);
    }
  }

  /**
   * Start recording a stream
   */
  async startRecording(streamId: number, durationMinutes: number = 60): Promise<number> {
    try {
      // Check if already recording
      const existingSession = Array.from(this.recordings.values()).find(
        r => r.streamId === streamId && r.status === 'recording'
      );
      
      if (existingSession) {
        throw new Error('Stream is already being recorded');
      }

      // Get stream info
      const stream = await this.storage.getStream(streamId);
      if (!stream) {
        throw new Error('Stream not found');
      }

      // Generate output filename
      const timestamp = Date.now();
      const filename = `stream_${streamId}_${timestamp}.ts`;
      const outputPath = path.join(this.recordingsDir, filename);

      // Create archive record in database
      const archive = await this.storage.createTvArchiveEntry({
        streamId,
        archiveFile: filename,
        startTime: new Date(),
        endTime: new Date(Date.now() + durationMinutes * 60 * 1000),
        fileSize: 0,
        status: 'recording'
      });

      const archiveId = archive.id;

      // Start FFmpeg recording process
      const ffmpegArgs = [
        '-i', stream.sourceUrl,
        '-c', 'copy',
        '-t', `${durationMinutes * 60}`, // duration in seconds
        '-f', 'mpegts',
        outputPath
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      // Create recording session
      const session: RecordingSession = {
        id: archiveId,
        streamId,
        process: ffmpegProcess,
        outputPath,
        startTime: new Date(),
        duration: durationMinutes,
        status: 'recording'
      };

      this.recordings.set(archiveId, session);

      // Handle process events
      ffmpegProcess.stdout?.on('data', (data) => {
        // Log progress if needed
        // console.log(`[DVR ${archiveId}] ${data.toString()}`);
      });

      ffmpegProcess.stderr?.on('data', (data) => {
        // FFmpeg outputs to stderr even for normal operation
        const message = data.toString();
        if (message.includes('error') || message.includes('Error')) {
          console.error(`[DVR ${archiveId}] Error: ${message}`);
        }
      });

      ffmpegProcess.on('close', async (code) => {
        await this.handleRecordingComplete(archiveId, code === 0);
      });

      // Auto-stop after duration
      setTimeout(() => {
        this.stopRecording(archiveId);
      }, durationMinutes * 60 * 1000);

      console.log(`[DVR] Started recording stream ${streamId} (ID: ${archiveId}) for ${durationMinutes} minutes`);
      return archiveId;

    } catch (error: any) {
      console.error('[DVR] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop an active recording
   */
  async stopRecording(recordingId: number): Promise<void> {
    const session = this.recordings.get(recordingId);
    if (!session) {
      throw new Error('Recording not found');
    }

    if (session.status !== 'recording') {
      throw new Error('Recording is not active');
    }

    try {
      // Gracefully stop FFmpeg
      session.process.kill('SIGTERM');
      
      // Wait a bit, then force kill if needed
      setTimeout(() => {
        if (session.process.killed === false) {
          session.process.kill('SIGKILL');
        }
      }, 5000);

      console.log(`[DVR] Stopped recording ${recordingId}`);
    } catch (error) {
      console.error(`[DVR] Error stopping recording ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Handle recording completion
   */
  private async handleRecordingComplete(recordingId: number, success: boolean) {
    const session = this.recordings.get(recordingId);
    if (!session) return;

    try {
      // Get file size
      let fileSize = 0;
      try {
        const stats = await fs.stat(session.outputPath);
        fileSize = stats.size;
      } catch (error) {
        console.error(`[DVR] Failed to get file size for recording ${recordingId}`);
      }

      // Update database
      await this.storage.updateTvArchive(recordingId, {
        status: success ? 'completed' : 'error',
        endTime: new Date(),
        fileSize
      });

      session.status = success ? 'completed' : 'error';
      
      console.log(`[DVR] Recording ${recordingId} ${success ? 'completed' : 'failed'} (${fileSize} bytes)`);
      
      // Keep recording in map for reference but mark as complete
      // Could implement cleanup after certain time
    } catch (error) {
      console.error(`[DVR] Error handling recording completion ${recordingId}:`, error);
    }
  }

  /**
   * Get recording status
   */
  getRecordingStatus(recordingId: number): RecordingSession | undefined {
    return this.recordings.get(recordingId);
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings(): RecordingSession[] {
    return Array.from(this.recordings.values()).filter(r => r.status === 'recording');
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: number): Promise<void> {
    try {
      // Get recording info from database
      const archive = await this.storage.getTvArchive(recordingId);
      if (!archive) {
        throw new Error('Recording not found');
      }

      // Stop if still recording
      const session = this.recordings.get(recordingId);
      if (session && session.status === 'recording') {
        await this.stopRecording(recordingId);
      }

      // Delete file
      const filePath = path.join(this.recordingsDir, archive.archiveFile);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`[DVR] Failed to delete file ${filePath}:`, error);
      }

      // Delete from database
      await this.storage.deleteTvArchive(recordingId);

      // Remove from recordings map
      this.recordings.delete(recordingId);

      console.log(`[DVR] Deleted recording ${recordingId}`);
    } catch (error) {
      console.error(`[DVR] Error deleting recording ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Get recording file path for streaming
   */
  getRecordingPath(recordingId: number): string | null {
    const session = this.recordings.get(recordingId);
    return session ? session.outputPath : null;
  }

  /**
   * Calculate total storage used by recordings
   */
  async getStorageUsed(): Promise<number> {
    try {
      const files = await fs.readdir(this.recordingsDir);
      let totalSize = 0;

      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(this.recordingsDir, file));
          totalSize += stats.size;
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[DVR] Error calculating storage:', error);
      return 0;
    }
  }

  /**
   * Cleanup old recordings based on age or storage limit
   */
  async cleanupOldRecordings(maxAgeHours: number = 168): Promise<number> {
    try {
      const archives = await this.storage.getTvArchives();
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      let deletedCount = 0;
      
      for (const archive of archives) {
        if (archive.startTime < cutoffTime && archive.status === 'completed') {
          try {
            await this.deleteRecording(archive.id);
            deletedCount++;
          } catch (error) {
            console.error(`[DVR] Failed to cleanup recording ${archive.id}:`, error);
          }
        }
      }

      console.log(`[DVR] Cleaned up ${deletedCount} old recordings`);
      return deletedCount;
    } catch (error) {
      console.error('[DVR] Error during cleanup:', error);
      return 0;
    }
  }
}

// Singleton instance
let dvrManager: DVRManager | null = null;

export function initializeDVRManager(storage: Storage, recordingsDir?: string): DVRManager {
  if (!dvrManager) {
    dvrManager = new DVRManager(storage, recordingsDir);
    
    // Auto-cleanup every 24 hours
    setInterval(() => {
      dvrManager?.cleanupOldRecordings(168); // 7 days
    }, 24 * 60 * 60 * 1000);
  }
  return dvrManager;
}

export function getDVRManager(): DVRManager | null {
  return dvrManager;
}
