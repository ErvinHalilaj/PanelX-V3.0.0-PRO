import { spawn, ChildProcess } from 'child_process';
import { storage } from './storage';
import type { Stream, TranscodeProfile } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

// Directory for HLS output
const STREAMS_DIR = path.join(process.cwd(), 'streams');

// Ensure streams directory exists
if (!fs.existsSync(STREAMS_DIR)) {
  fs.mkdirSync(STREAMS_DIR, { recursive: true });
}

interface StreamProcess {
  pid: number;
  process: ChildProcess;
  streamId: number;
  startedAt: Date;
  viewerCount: number;
  status: 'starting' | 'running' | 'stopping' | 'error';
  outputPath: string;
  serverId?: number;
}

class FFmpegProcessManager {
  private processes: Map<number, StreamProcess> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Start FFmpeg process for a stream
   */
  async startStream(streamId: number): Promise<void> {
    console.log(`[FFmpeg] Starting stream ${streamId}...`);

    // Check if already running
    if (this.processes.has(streamId)) {
      const proc = this.processes.get(streamId)!;
      if (proc.status === 'running' || proc.status === 'starting') {
        console.log(`[FFmpeg] Stream ${streamId} already running`);
        return;
      }
    }

    // Get stream from database
    const stream = await storage.getStream(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    // Build FFmpeg command
    const cmd = await this.buildFfmpegCommand(stream);
    const outputPath = path.join(STREAMS_DIR, `stream_${streamId}.m3u8`);

    console.log(`[FFmpeg] Command: ffmpeg ${cmd.join(' ')}`);

    // Spawn FFmpeg process
    const ffmpeg = spawn('ffmpeg', cmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Store process info
    const streamProcess: StreamProcess = {
      pid: ffmpeg.pid!,
      process: ffmpeg,
      streamId,
      startedAt: new Date(),
      viewerCount: 0,
      status: 'starting',
      outputPath,
    };

    this.processes.set(streamId, streamProcess);

    // Update database
    await storage.updateStream(streamId, {
      monitorStatus: 'online',
    } as any);

    // Handle process events
    ffmpeg.stdout?.on('data', (data) => {
      // FFmpeg outputs to stderr, but capture stdout just in case
      const output = data.toString();
      if (output.includes('Opening')) {
        console.log(`[FFmpeg ${streamId}] ${output.trim()}`);
      }
    });

    ffmpeg.stderr?.on('data', (data) => {
      const output = data.toString();
      
      // Check for key events
      if (output.includes('Output #0')) {
        console.log(`[FFmpeg ${streamId}] HLS output started`);
        streamProcess.status = 'running';
      }
      
      // Log errors
      if (output.includes('error') || output.includes('Error')) {
        console.error(`[FFmpeg ${streamId}] ERROR: ${output.trim()}`);
      }
    });

    ffmpeg.on('exit', async (code, signal) => {
      console.log(`[FFmpeg ${streamId}] Process exited with code ${code}, signal ${signal}`);
      
      // Remove from active processes
      this.processes.delete(streamId);

      // Update database
      await storage.updateStream(streamId, {
        monitorStatus: 'offline',
      } as any);

      // Log error if unexpected exit
      if (code !== 0 && code !== null) {
        await storage.logStreamError({
          streamId,
          errorType: 'ffmpeg_crash',
          errorMessage: `FFmpeg exited with code ${code}`,
        });

        // Auto-restart if enabled
        const currentStream = await storage.getStream(streamId);
        if (currentStream?.autoRestart && streamProcess.viewerCount > 0) {
          console.log(`[FFmpeg ${streamId}] Auto-restarting...`);
          setTimeout(() => this.startStream(streamId), 5000);
        }
      }
    });

    ffmpeg.on('error', async (err) => {
      console.error(`[FFmpeg ${streamId}] Failed to start:`, err);
      streamProcess.status = 'error';
      
      await storage.logStreamError({
        streamId,
        errorType: 'ffmpeg_start_failed',
        errorMessage: err.message,
      });
    });

    // Wait for HLS playlist to be created
    await this.waitForHLSOutput(outputPath, 30000);
  }

  /**
   * Stop FFmpeg process for a stream
   */
  async stopStream(streamId: number): Promise<void> {
    console.log(`[FFmpeg] Stopping stream ${streamId}...`);

    const streamProcess = this.processes.get(streamId);
    if (!streamProcess) {
      console.log(`[FFmpeg] Stream ${streamId} not running`);
      return;
    }

    streamProcess.status = 'stopping';

    // Send SIGTERM for graceful shutdown
    streamProcess.process.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (this.processes.has(streamId)) {
        console.log(`[FFmpeg ${streamId}] Force killing...`);
        streamProcess.process.kill('SIGKILL');
        this.processes.delete(streamId);
      }
    }, 5000);

    // Cleanup HLS files
    this.cleanupStreamFiles(streamId);

    // Update database
    await storage.updateStream(streamId, {
      monitorStatus: 'offline',
    } as any);
  }

  /**
   * Restart a stream
   */
  async restartStream(streamId: number): Promise<void> {
    console.log(`[FFmpeg] Restarting stream ${streamId}...`);
    await this.stopStream(streamId);
    
    // Wait for process to fully stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.startStream(streamId);
  }

  /**
   * Check if stream is running
   */
  isRunning(streamId: number): boolean {
    const proc = this.processes.get(streamId);
    return proc?.status === 'running' || proc?.status === 'starting';
  }

  /**
   * Get stream status
   */
  getStatus(streamId: number): string | null {
    return this.processes.get(streamId)?.status || null;
  }

  /**
   * Get output path for stream
   */
  getOutputPath(streamId: number): string {
    return path.join(STREAMS_DIR, `stream_${streamId}.m3u8`);
  }

  /**
   * Get segment path for stream
   */
  getSegmentPath(streamId: number, segmentName: string): string {
    return path.join(STREAMS_DIR, segmentName);
  }

  /**
   * Track viewer connection
   */
  async onViewerConnect(streamId: number): Promise<void> {
    const proc = this.processes.get(streamId);
    if (proc) {
      proc.viewerCount++;
      console.log(`[FFmpeg ${streamId}] Viewer connected. Total: ${proc.viewerCount}`);
    }

    // Start stream if not running (On-Demand mode)
    if (!this.isRunning(streamId)) {
      const stream = await storage.getStream(streamId);
      if (stream?.onDemand) {
        console.log(`[FFmpeg ${streamId}] Starting On-Demand stream`);
        await this.startStream(streamId);
      }
    }
  }

  /**
   * Track viewer disconnection
   */
  async onViewerDisconnect(streamId: number): Promise<void> {
    const proc = this.processes.get(streamId);
    if (proc) {
      proc.viewerCount = Math.max(0, proc.viewerCount - 1);
      console.log(`[FFmpeg ${streamId}] Viewer disconnected. Total: ${proc.viewerCount}`);

      // Stop stream if no viewers (On-Demand mode)
      if (proc.viewerCount === 0) {
        const stream = await storage.getStream(streamId);
        if (stream?.onDemand) {
          console.log(`[FFmpeg ${streamId}] Stopping On-Demand stream (no viewers)`);
          setTimeout(() => {
            // Double-check viewer count before stopping
            const currentProc = this.processes.get(streamId);
            if (currentProc && currentProc.viewerCount === 0) {
              this.stopStream(streamId);
            }
          }, 30000); // Wait 30s before stopping
        }
      }
    }
  }

  /**
   * Build FFmpeg command based on stream configuration
   */
  private async buildFfmpegCommand(stream: Stream): Promise<string[]> {
    const outputPath = path.join(STREAMS_DIR, `stream_${stream.id}.m3u8`);
    const segmentPattern = path.join(STREAMS_DIR, `stream_${stream.id}_%03d.ts`);

    const cmd: string[] = [
      '-hide_banner',
      '-loglevel', 'info',
      '-i', stream.sourceUrl,
    ];

    // Apply transcode profile if set
    if (stream.transcodeProfileId) {
      const profile = await storage.getTranscodeProfile(stream.transcodeProfileId);
      if (profile) {
        // Video codec
        cmd.push('-c:v', profile.videoCodec || 'copy');
        if (profile.videoBitrate && profile.videoCodec !== 'copy') {
          cmd.push('-b:v', profile.videoBitrate);
        }
        if (profile.resolution && profile.videoCodec !== 'copy') {
          cmd.push('-s', profile.resolution);
        }
        if (profile.preset && profile.videoCodec !== 'copy') {
          cmd.push('-preset', profile.preset);
        }

        // Audio codec
        cmd.push('-c:a', profile.audioCodec || 'copy');
        if (profile.audioBitrate && profile.audioCodec !== 'copy') {
          cmd.push('-b:a', profile.audioBitrate);
        }

        // Custom parameters
        if (profile.customParams) {
          cmd.push(...profile.customParams.split(' '));
        }
      }
    } else {
      // Default: copy codecs (no transcoding)
      cmd.push('-c:v', 'copy', '-c:a', 'copy');
    }

    // HLS output settings
    cmd.push(
      '-f', 'hls',
      '-hls_time', '10',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', segmentPattern,
      '-hls_segment_type', 'mpegts',
      '-hls_base_url', '/streams/',  // Make segments accessible via /streams/ path
    );

    // Custom FFmpeg parameters from stream
    if (stream.customFfmpeg) {
      cmd.push(...stream.customFfmpeg.split(' '));
    }

    // Output file
    cmd.push(outputPath);

    return cmd;
  }

  /**
   * Wait for HLS output to be created
   */
  private async waitForHLSOutput(outputPath: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    let lastCheck = '';
    
    while (Date.now() - startTime < timeout) {
      if (fs.existsSync(outputPath)) {
        // Check if playlist has segments
        try {
          const content = fs.readFileSync(outputPath, 'utf-8');
          if (content.includes('.ts') && content.includes('#EXTINF:')) {
            console.log(`[FFmpeg] HLS output ready: ${outputPath}`);
            return;
          }
          lastCheck = `File exists but no segments yet (${content.length} bytes)`;
        } catch (err) {
          lastCheck = `File exists but cannot read: ${err}`;
        }
      } else {
        lastCheck = 'File does not exist yet';
      }
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.error(`[FFmpeg] Timeout waiting for HLS output. Last check: ${lastCheck}`);
    throw new Error(`HLS output not created within ${timeout}ms`);
  }

  /**
   * Cleanup stream files
   */
  private cleanupStreamFiles(streamId: number): void {
    const pattern = `stream_${streamId}`;
    
    try {
      const files = fs.readdirSync(STREAMS_DIR);
      for (const file of files) {
        if (file.startsWith(pattern)) {
          const filePath = path.join(STREAMS_DIR, file);
          fs.unlinkSync(filePath);
          console.log(`[FFmpeg] Cleaned up: ${file}`);
        }
      }
    } catch (err) {
      console.error(`[FFmpeg] Cleanup error:`, err);
    }
  }

  /**
   * Health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [streamId, proc] of this.processes.entries()) {
        // Check if process still exists
        try {
          process.kill(proc.pid, 0); // Signal 0 = check if alive
        } catch (err) {
          console.log(`[FFmpeg ${streamId}] Process died unexpectedly`);
          this.processes.delete(streamId);
          
          await storage.updateStream(streamId, {
            monitorStatus: 'offline',
          } as any);
        }

        // Check for stale processes (running too long)
        const stream = await storage.getStream(streamId);
        if (stream?.autoRestartHours && stream.autoRestartHours > 0) {
          const hoursSinceStart = (Date.now() - proc.startedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceStart >= stream.autoRestartHours) {
            console.log(`[FFmpeg ${streamId}] Auto-restarting after ${stream.autoRestartHours} hours`);
            await this.restartStream(streamId);
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Cleanup all processes
   */
  async cleanup(): Promise<void> {
    console.log('[FFmpeg] Shutting down all processes...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const stopPromises = Array.from(this.processes.keys()).map(streamId => 
      this.stopStream(streamId)
    );

    await Promise.all(stopPromises);
    console.log('[FFmpeg] Cleanup complete');
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): Map<number, StreamProcess> {
    return new Map(this.processes);
  }
}

// Singleton instance
export const ffmpegManager = new FFmpegProcessManager();
