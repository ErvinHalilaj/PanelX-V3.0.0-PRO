/**
 * Timeshift Manager
 * Handles live stream buffering, seeking, and catchup functionality
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type { Stream } from '@shared/schema';

interface TimeshiftSession {
  streamId: number;
  startTime: Date;
  bufferPath: string;
  process: ChildProcess | null;
  pid: number | null;
  status: 'buffering' | 'active' | 'stopped' | 'error';
  segments: TimeshiftSegment[];
  currentPosition: number; // seconds from start
}

interface TimeshiftSegment {
  index: number;
  file: string;
  duration: number; // seconds
  startTime: Date;
  size: number; // bytes
}

interface TimeshiftPosition {
  streamId: number;
  position: number; // seconds from start
  timestamp: Date;
  availableRange: {
    start: number;
    end: number;
  };
}

class TimeshiftManager {
  private sessions: Map<number, TimeshiftSession>;
  private readonly bufferDir: string;
  private readonly segmentDuration: number = 10; // 10 second segments
  private readonly maxBufferDuration: number = 7200; // 2 hours max buffer

  constructor() {
    this.sessions = new Map();
    this.bufferDir = process.env.TIMESHIFT_BUFFER_DIR || '/tmp/timeshift';
    this.initBufferDir();
    
    // Cleanup old buffers every hour
    setInterval(() => this.cleanupOldBuffers(), 3600000);
  }

  private async initBufferDir() {
    try {
      await fs.mkdir(this.bufferDir, { recursive: true });
      console.log('[TimeshiftManager] Buffer directory initialized:', this.bufferDir);
    } catch (error) {
      console.error('[TimeshiftManager] Failed to create buffer directory:', error);
    }
  }

  /**
   * Start timeshift buffering for a stream
   */
  async startTimeshift(stream: Stream): Promise<TimeshiftSession> {
    const streamId = stream.id;

    // Check if already running
    if (this.sessions.has(streamId)) {
      const existing = this.sessions.get(streamId)!;
      if (existing.status === 'active' || existing.status === 'buffering') {
        return existing;
      }
    }

    const bufferPath = path.join(this.bufferDir, `stream_${streamId}`);
    await fs.mkdir(bufferPath, { recursive: true });

    const session: TimeshiftSession = {
      streamId,
      startTime: new Date(),
      bufferPath,
      process: null,
      pid: null,
      status: 'buffering',
      segments: [],
      currentPosition: 0,
    };

    try {
      // Start FFmpeg to buffer the stream
      const ffmpegArgs = [
        '-i', stream.sourceUrl,
        '-c', 'copy',
        '-f', 'hls',
        '-hls_time', this.segmentDuration.toString(),
        '-hls_list_size', '0', // Keep all segments
        '-hls_flags', 'delete_segments+append_list',
        '-hls_segment_filename', path.join(bufferPath, 'segment_%d.ts'),
        path.join(bufferPath, 'playlist.m3u8'),
      ];

      console.log('[TimeshiftManager] Starting timeshift for stream:', streamId);
      console.log('[TimeshiftManager] FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

      const process = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      session.process = process;
      session.pid = process.pid || null;
      session.status = 'active';

      process.on('error', (error) => {
        console.error(`[TimeshiftManager] FFmpeg error for stream ${streamId}:`, error);
        session.status = 'error';
      });

      process.on('exit', (code) => {
        console.log(`[TimeshiftManager] FFmpeg exited for stream ${streamId} with code:`, code);
        session.status = 'stopped';
        session.process = null;
        session.pid = null;
      });

      // Monitor segments
      this.monitorSegments(session);

      this.sessions.set(streamId, session);
      return session;

    } catch (error) {
      console.error('[TimeshiftManager] Failed to start timeshift:', error);
      session.status = 'error';
      throw error;
    }
  }

  /**
   * Stop timeshift buffering
   */
  async stopTimeshift(streamId: number): Promise<void> {
    const session = this.sessions.get(streamId);
    if (!session) {
      throw new Error(`No timeshift session found for stream ${streamId}`);
    }

    if (session.process) {
      try {
        // Graceful shutdown
        session.process.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        console.error('[TimeshiftManager] Error stopping timeshift:', error);
      }
    }

    session.status = 'stopped';
    session.process = null;
    session.pid = null;

    // Clean up buffer after 1 hour
    setTimeout(async () => {
      try {
        await fs.rm(session.bufferPath, { recursive: true, force: true });
        this.sessions.delete(streamId);
        console.log('[TimeshiftManager] Cleaned up buffer for stream:', streamId);
      } catch (error) {
        console.error('[TimeshiftManager] Error cleaning up buffer:', error);
      }
    }, 3600000);
  }

  /**
   * Get timeshift position and available range
   */
  getPosition(streamId: number): TimeshiftPosition | null {
    const session = this.sessions.get(streamId);
    if (!session) {
      return null;
    }

    const now = new Date();
    const elapsed = (now.getTime() - session.startTime.getTime()) / 1000;
    const maxBuffer = Math.min(elapsed, this.maxBufferDuration);

    return {
      streamId,
      position: session.currentPosition,
      timestamp: now,
      availableRange: {
        start: 0,
        end: maxBuffer,
      },
    };
  }

  /**
   * Seek to a specific position
   */
  async seekTo(streamId: number, positionSeconds: number): Promise<string> {
    const session = this.sessions.get(streamId);
    if (!session) {
      throw new Error(`No timeshift session found for stream ${streamId}`);
    }

    const position = this.getPosition(streamId);
    if (!position) {
      throw new Error('Failed to get timeshift position');
    }

    // Validate position is within available range
    if (positionSeconds < position.availableRange.start || positionSeconds > position.availableRange.end) {
      throw new Error(
        `Position ${positionSeconds}s is outside available range [${position.availableRange.start}, ${position.availableRange.end}]`
      );
    }

    session.currentPosition = positionSeconds;

    // Generate HLS playlist starting from the requested position
    const playlistPath = await this.generatePlaylistFromPosition(session, positionSeconds);
    return playlistPath;
  }

  /**
   * Watch from start (position = 0)
   */
  async watchFromStart(streamId: number): Promise<string> {
    return this.seekTo(streamId, 0);
  }

  /**
   * Get live position (latest available)
   */
  async goLive(streamId: number): Promise<string> {
    const position = this.getPosition(streamId);
    if (!position) {
      throw new Error(`No timeshift session found for stream ${streamId}`);
    }

    return this.seekTo(streamId, position.availableRange.end);
  }

  /**
   * Get timeshift status
   */
  getStatus(streamId: number): TimeshiftSession | null {
    return this.sessions.get(streamId) || null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): TimeshiftSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Monitor segment creation
   */
  private async monitorSegments(session: TimeshiftSession) {
    const checkInterval = setInterval(async () => {
      if (session.status !== 'active' && session.status !== 'buffering') {
        clearInterval(checkInterval);
        return;
      }

      try {
        const files = await fs.readdir(session.bufferPath);
        const segmentFiles = files.filter(f => f.startsWith('segment_') && f.endsWith('.ts')).sort();

        // Update segments list
        for (const file of segmentFiles) {
          const index = parseInt(file.match(/segment_(\d+)\.ts/)?.[1] || '0');
          if (!session.segments.find(s => s.index === index)) {
            const filePath = path.join(session.bufferPath, file);
            const stats = await fs.stat(filePath);
            
            session.segments.push({
              index,
              file: filePath,
              duration: this.segmentDuration,
              startTime: new Date(session.startTime.getTime() + index * this.segmentDuration * 1000),
              size: stats.size,
            });
          }
        }

        // Remove old segments if exceeding max buffer
        const totalDuration = session.segments.length * this.segmentDuration;
        if (totalDuration > this.maxBufferDuration) {
          const segmentsToRemove = Math.floor((totalDuration - this.maxBufferDuration) / this.segmentDuration);
          const removedSegments = session.segments.splice(0, segmentsToRemove);
          
          // Delete files
          for (const segment of removedSegments) {
            try {
              await fs.unlink(segment.file);
            } catch (error) {
              console.error('[TimeshiftManager] Error deleting old segment:', error);
            }
          }
        }
      } catch (error) {
        console.error('[TimeshiftManager] Error monitoring segments:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Generate HLS playlist from specific position
   */
  private async generatePlaylistFromPosition(session: TimeshiftSession, positionSeconds: number): Promise<string> {
    const startSegmentIndex = Math.floor(positionSeconds / this.segmentDuration);
    const relevantSegments = session.segments.filter(s => s.index >= startSegmentIndex);

    if (relevantSegments.length === 0) {
      throw new Error('No segments available for requested position');
    }

    // Generate custom playlist
    const playlistLines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${this.segmentDuration}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
    ];

    for (const segment of relevantSegments) {
      playlistLines.push(`#EXTINF:${segment.duration},`);
      playlistLines.push(path.basename(segment.file));
    }

    playlistLines.push('#EXT-X-ENDLIST');

    const playlistContent = playlistLines.join('\n');
    const playlistPath = path.join(session.bufferPath, `playlist_${positionSeconds}.m3u8`);
    
    await fs.writeFile(playlistPath, playlistContent);
    return playlistPath;
  }

  /**
   * Cleanup old buffers
   */
  private async cleanupOldBuffers() {
    console.log('[TimeshiftManager] Running buffer cleanup...');
    
    try {
      const dirs = await fs.readdir(this.bufferDir);
      const now = Date.now();

      for (const dir of dirs) {
        if (!dir.startsWith('stream_')) continue;

        const dirPath = path.join(this.bufferDir, dir);
        const stats = await fs.stat(dirPath);
        
        // Remove buffers older than 3 hours
        if (now - stats.mtimeMs > 10800000) {
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log('[TimeshiftManager] Removed old buffer:', dir);
        }
      }
    } catch (error) {
      console.error('[TimeshiftManager] Error during cleanup:', error);
    }
  }
}

// Singleton instance
export const timeshiftManager = new TimeshiftManager();
