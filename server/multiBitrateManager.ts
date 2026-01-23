/**
 * Multi-Bitrate Manager
 * Handles adaptive bitrate streaming with multiple quality variants
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type { Stream, TranscodeProfile } from '@shared/schema';

export interface QualityVariant {
  id: string;
  label: string; // "1080p", "720p", "480p", "360p", "Auto"
  resolution: string; // "1920x1080"
  videoBitrate: string; // "4000k"
  audioBitrate: string; // "128k"
  bandwidth: number; // bytes per second
  enabled: boolean;
}

interface ABRSession {
  streamId: number;
  sourceUrl: string;
  variants: QualityVariant[];
  outputPath: string;
  process: ChildProcess | null;
  pid: number | null;
  status: 'initializing' | 'active' | 'stopped' | 'error';
  masterPlaylist: string;
  currentQuality?: string;
}

interface QualityProfile {
  label: string;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
  maxBandwidth: number; // Mbps
}

class MultiBitrateManager {
  private sessions: Map<number, ABRSession>;
  private readonly outputDir: string;

  // Default quality profiles
  private readonly defaultProfiles: QualityProfile[] = [
    {
      label: '1080p',
      resolution: '1920x1080',
      videoBitrate: '5000k',
      audioBitrate: '192k',
      maxBandwidth: 8,
    },
    {
      label: '720p',
      resolution: '1280x720',
      videoBitrate: '3000k',
      audioBitrate: '128k',
      maxBandwidth: 5,
    },
    {
      label: '480p',
      resolution: '854x480',
      videoBitrate: '1500k',
      audioBitrate: '128k',
      maxBandwidth: 2.5,
    },
    {
      label: '360p',
      resolution: '640x360',
      videoBitrate: '800k',
      audioBitrate: '96k',
      maxBandwidth: 1.5,
    },
  ];

  constructor() {
    this.sessions = new Map();
    this.outputDir = process.env.ABR_OUTPUT_DIR || '/tmp/abr';
    this.initOutputDir();
  }

  private async initOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log('[MultiBitrateManager] Output directory initialized:', this.outputDir);
    } catch (error) {
      console.error('[MultiBitrateManager] Failed to create output directory:', error);
    }
  }

  /**
   * Start adaptive bitrate streaming for a stream
   */
  async startABR(stream: Stream, variants?: QualityVariant[]): Promise<ABRSession> {
    const streamId = stream.id;

    // Check if already running
    if (this.sessions.has(streamId)) {
      const existing = this.sessions.get(streamId)!;
      if (existing.status === 'active' || existing.status === 'initializing') {
        return existing;
      }
    }

    const outputPath = path.join(this.outputDir, `stream_${streamId}`);
    await fs.mkdir(outputPath, { recursive: true });

    // Use provided variants or create from default profiles
    const qualityVariants = variants || this.createDefaultVariants();

    const session: ABRSession = {
      streamId,
      sourceUrl: stream.sourceUrl,
      variants: qualityVariants,
      outputPath,
      process: null,
      pid: null,
      status: 'initializing',
      masterPlaylist: path.join(outputPath, 'master.m3u8'),
    };

    try {
      // Build FFmpeg command for multi-bitrate transcoding
      const ffmpegArgs = this.buildFFmpegCommand(stream.sourceUrl, outputPath, qualityVariants);

      console.log('[MultiBitrateManager] Starting ABR for stream:', streamId);
      console.log('[MultiBitrateManager] Variants:', qualityVariants.map(v => v.label).join(', '));

      const process = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      session.process = process;
      session.pid = process.pid || null;
      session.status = 'active';

      process.stdout?.on('data', (data) => {
        // Optional: Parse FFmpeg output for statistics
      });

      process.stderr?.on('data', (data) => {
        // FFmpeg logs to stderr
        const output = data.toString();
        if (output.includes('error') || output.includes('Error')) {
          console.error(`[MultiBitrateManager] FFmpeg error for stream ${streamId}:`, output);
        }
      });

      process.on('error', (error) => {
        console.error(`[MultiBitrateManager] Process error for stream ${streamId}:`, error);
        session.status = 'error';
      });

      process.on('exit', (code) => {
        console.log(`[MultiBitrateManager] FFmpeg exited for stream ${streamId} with code:`, code);
        session.status = 'stopped';
        session.process = null;
        session.pid = null;
      });

      // Generate master playlist
      await this.generateMasterPlaylist(session);

      this.sessions.set(streamId, session);
      return session;

    } catch (error) {
      console.error('[MultiBitrateManager] Failed to start ABR:', error);
      session.status = 'error';
      throw error;
    }
  }

  /**
   * Stop adaptive bitrate streaming
   */
  async stopABR(streamId: number): Promise<void> {
    const session = this.sessions.get(streamId);
    if (!session) {
      throw new Error(`No ABR session found for stream ${streamId}`);
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
        console.error('[MultiBitrateManager] Error stopping ABR:', error);
      }
    }

    session.status = 'stopped';
    session.process = null;
    session.pid = null;

    // Clean up files after 1 hour
    setTimeout(async () => {
      try {
        await fs.rm(session.outputPath, { recursive: true, force: true });
        this.sessions.delete(streamId);
        console.log('[MultiBitrateManager] Cleaned up ABR output for stream:', streamId);
      } catch (error) {
        console.error('[MultiBitrateManager] Error cleaning up ABR output:', error);
      }
    }, 3600000);
  }

  /**
   * Get ABR session status
   */
  getSession(streamId: number): ABRSession | null {
    return this.sessions.get(streamId) || null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): ABRSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get available quality variants for a stream
   */
  getVariants(streamId: number): QualityVariant[] {
    const session = this.sessions.get(streamId);
    return session?.variants || [];
  }

  /**
   * Get master playlist URL
   */
  getMasterPlaylistUrl(streamId: number): string | null {
    const session = this.sessions.get(streamId);
    return session?.masterPlaylist || null;
  }

  /**
   * Create default quality variants
   */
  private createDefaultVariants(): QualityVariant[] {
    return this.defaultProfiles.map((profile, index) => ({
      id: `variant_${index}`,
      label: profile.label,
      resolution: profile.resolution,
      videoBitrate: profile.videoBitrate,
      audioBitrate: profile.audioBitrate,
      bandwidth: this.calculateBandwidth(profile.videoBitrate, profile.audioBitrate),
      enabled: true,
    }));
  }

  /**
   * Calculate bandwidth in bytes per second
   */
  private calculateBandwidth(videoBitrate: string, audioBitrate: string): number {
    const parseKbps = (bitrate: string): number => {
      const match = bitrate.match(/(\d+)k/);
      return match ? parseInt(match[1]) * 1000 : 0;
    };

    const video = parseKbps(videoBitrate);
    const audio = parseKbps(audioBitrate);
    return (video + audio) / 8; // Convert to bytes per second
  }

  /**
   * Build FFmpeg command for multi-bitrate transcoding
   */
  private buildFFmpegCommand(sourceUrl: string, outputPath: string, variants: QualityVariant[]): string[] {
    const args = [
      '-i', sourceUrl,
      '-c:a', 'aac',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-g', '48', // GOP size
      '-sc_threshold', '0',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+independent_segments',
    ];

    // Add variant streams
    variants.forEach((variant, index) => {
      const variantPath = path.join(outputPath, `${variant.label.toLowerCase()}`);
      
      args.push(
        '-map', '0:v:0',
        '-map', '0:a:0',
        '-s:v:' + index, variant.resolution,
        '-b:v:' + index, variant.videoBitrate,
        '-maxrate:v:' + index, variant.videoBitrate,
        '-bufsize:v:' + index, this.parseKbps(variant.videoBitrate) * 2 + 'k',
        '-b:a:' + index, variant.audioBitrate,
        '-hls_segment_filename', path.join(variantPath, 'segment_%03d.ts'),
        path.join(variantPath, 'playlist.m3u8')
      );
    });

    return args;
  }

  /**
   * Generate HLS master playlist
   */
  private async generateMasterPlaylist(session: ABRSession): Promise<void> {
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

    for (const variant of session.variants) {
      if (!variant.enabled) continue;

      const bandwidth = variant.bandwidth;
      const resolution = variant.resolution;
      const playlistPath = `${variant.label.toLowerCase()}/playlist.m3u8`;

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},NAME="${variant.label}"`,
        playlistPath
      );
    }

    const content = lines.join('\n');
    await fs.writeFile(session.masterPlaylist, content);
    
    console.log('[MultiBitrateManager] Generated master playlist:', session.masterPlaylist);
  }

  /**
   * Parse bitrate string to number
   */
  private parseKbps(bitrate: string): number {
    const match = bitrate.match(/(\d+)k/);
    return match ? parseInt(match[1]) : 0;
  }
}

// Singleton instance
export const multiBitrateManager = new MultiBitrateManager();
