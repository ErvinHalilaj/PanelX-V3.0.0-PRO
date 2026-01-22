import { Client as SSHClient, ClientChannel } from 'ssh2';
import { storage } from './storage';
import type { Server, Stream } from '@shared/schema';
import * as path from 'path';

interface RemoteStreamProcess {
  serverId: number;
  streamId: number;
  pid: number;
  startedAt: Date;
  sshConnection?: SSHClient;
}

class LoadBalancerManager {
  private remoteProcesses: Map<string, RemoteStreamProcess> = new Map();

  /**
   * Select best server for a stream
   */
  async selectServer(stream: Stream, clientIp?: string): Promise<Server | null> {
    // If stream has forced server, use it
    if (stream.serverId) {
      const server = await storage.getServer(stream.serverId);
      if (server && server.enabled && server.status === 'online') {
        return server;
      }
    }

    // Get all available servers
    const servers = await storage.getServers();
    const available = servers.filter(s => 
      s.enabled &&
      s.status === 'online' &&
      !s.isMainServer &&
      (s.currentClients || 0) < (s.maxClients || 1000) &&
      (s.cpuUsage || 0) < 80 &&
      (s.memoryUsage || 0) < 90
    );

    if (available.length === 0) {
      console.log('[LoadBalancer] No available servers');
      return null;
    }

    // TODO: Implement geo-routing based on clientIp and server.geoZone
    // For now, select least loaded server
    available.sort((a, b) => (a.currentClients || 0) - (b.currentClients || 0));
    
    return available[0];
  }

  /**
   * Start FFmpeg on remote server
   */
  async startRemoteFFmpeg(server: Server, stream: Stream): Promise<number> {
    console.log(`[LoadBalancer] Starting FFmpeg on server ${server.serverName} for stream ${stream.id}`);

    return new Promise((resolve, reject) => {
      const ssh = new SSHClient();

      ssh.on('ready', async () => {
        try {
          // Build FFmpeg command
          const cmd = await this.buildRemoteFFmpegCommand(stream, server);
          
          console.log(`[LoadBalancer] Executing: ${cmd}`);

          ssh.exec(cmd, (err, stream) => {
            if (err) {
              ssh.end();
              return reject(err);
            }

            let output = '';
            let errorOutput = '';

            stream.on('data', (data: Buffer) => {
              output += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
              errorOutput += data.toString();
              
              // Log FFmpeg output
              console.log(`[LoadBalancer FFmpeg ${stream}] ${data.toString().trim()}`);
            });

            stream.on('close', (code: number) => {
              ssh.end();

              if (code !== 0) {
                console.error(`[LoadBalancer] FFmpeg failed with code ${code}`);
                console.error(errorOutput);
                reject(new Error(`FFmpeg exited with code ${code}`));
              } else {
                // Extract PID from output
                const pidMatch = output.match(/PID:\s*(\d+)/);
                if (pidMatch) {
                  const pid = parseInt(pidMatch[1]);
                  
                  // Store process info
                  const key = `${server.id}_${stream.id}`;
                  this.remoteProcesses.set(key, {
                    serverId: server.id,
                    streamId: stream.id,
                    pid,
                    startedAt: new Date(),
                  });

                  resolve(pid);
                } else {
                  reject(new Error('Failed to extract PID from output'));
                }
              }
            });
          });
        } catch (err) {
          ssh.end();
          reject(err);
        }
      });

      ssh.on('error', (err) => {
        console.error(`[LoadBalancer] SSH connection error:`, err);
        reject(err);
      });

      // Connect to server
      const sshConfig: any = {
        host: server.sshHost || server.serverUrl,
        port: server.sshPort || 22,
        username: server.sshUsername || 'root',
      };

      if (server.sshPassword) {
        sshConfig.password = server.sshPassword;
      } else if (server.sshPrivateKey) {
        sshConfig.privateKey = server.sshPrivateKey;
      } else {
        return reject(new Error('No SSH authentication method provided'));
      }

      ssh.connect(sshConfig);
    });
  }

  /**
   * Stop FFmpeg on remote server
   */
  async stopRemoteFFmpeg(server: Server, streamId: number): Promise<void> {
    console.log(`[LoadBalancer] Stopping FFmpeg on server ${server.serverName} for stream ${streamId}`);

    const key = `${server.id}_${streamId}`;
    const process = this.remoteProcesses.get(key);

    if (!process) {
      console.log(`[LoadBalancer] No remote process found for stream ${streamId} on server ${server.id}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const ssh = new SSHClient();

      ssh.on('ready', () => {
        const cmd = `kill -TERM ${process.pid} 2>/dev/null || true`;
        
        ssh.exec(cmd, (err, stream) => {
          if (err) {
            ssh.end();
            return reject(err);
          }

          stream.on('close', () => {
            ssh.end();
            this.remoteProcesses.delete(key);
            console.log(`[LoadBalancer] Stopped FFmpeg PID ${process.pid} on server ${server.serverName}`);
            resolve();
          });
        });
      });

      ssh.on('error', (err) => {
        console.error(`[LoadBalancer] SSH connection error:`, err);
        reject(err);
      });

      const sshConfig: any = {
        host: server.sshHost || server.serverUrl,
        port: server.sshPort || 22,
        username: server.sshUsername || 'root',
      };

      if (server.sshPassword) {
        sshConfig.password = server.sshPassword;
      } else if (server.sshPrivateKey) {
        sshConfig.privateKey = server.sshPrivateKey;
      }

      ssh.connect(sshConfig);
    });
  }

  /**
   * Check if FFmpeg is running on remote server
   */
  async isRemoteFFmpegRunning(server: Server, streamId: number): Promise<boolean> {
    const key = `${server.id}_${streamId}`;
    const process = this.remoteProcesses.get(key);

    if (!process) {
      return false;
    }

    // Check if process is still running via SSH
    return new Promise((resolve) => {
      const ssh = new SSHClient();

      ssh.on('ready', () => {
        const cmd = `ps -p ${process.pid} > /dev/null 2>&1 && echo "running" || echo "stopped"`;
        
        ssh.exec(cmd, (err, stream) => {
          if (err) {
            ssh.end();
            return resolve(false);
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('close', () => {
            ssh.end();
            const isRunning = output.trim() === 'running';
            
            if (!isRunning) {
              // Process died, remove from tracking
              this.remoteProcesses.delete(key);
            }
            
            resolve(isRunning);
          });
        });
      });

      ssh.on('error', () => {
        resolve(false);
      });

      const sshConfig: any = {
        host: server.sshHost || server.serverUrl,
        port: server.sshPort || 22,
        username: server.sshUsername || 'root',
      };

      if (server.sshPassword) {
        sshConfig.password = server.sshPassword;
      } else if (server.sshPrivateKey) {
        sshConfig.privateKey = server.sshPrivateKey;
      }

      ssh.connect(sshConfig);
    });
  }

  /**
   * Build FFmpeg command for remote execution
   */
  private async buildRemoteFFmpegCommand(stream: Stream, server: Server): Promise<string> {
    const outputPath = `/tmp/streams/stream_${stream.id}.m3u8`;
    const segmentPattern = `/tmp/streams/stream_${stream.id}_%03d.ts`;

    // Ensure output directory exists
    let cmd = `mkdir -p /tmp/streams && `;

    // Build FFmpeg command
    cmd += `nohup ffmpeg -hide_banner -loglevel info `;
    cmd += `-i "${stream.sourceUrl}" `;

    // Apply transcode profile if set
    if (stream.transcodeProfileId) {
      const profile = await storage.getTranscodeProfile(stream.transcodeProfileId);
      if (profile) {
        cmd += `-c:v ${profile.videoCodec || 'copy'} `;
        if (profile.videoBitrate && profile.videoCodec !== 'copy') {
          cmd += `-b:v ${profile.videoBitrate} `;
        }
        if (profile.resolution && profile.videoCodec !== 'copy') {
          cmd += `-s ${profile.resolution} `;
        }
        if (profile.preset && profile.videoCodec !== 'copy') {
          cmd += `-preset ${profile.preset} `;
        }

        cmd += `-c:a ${profile.audioCodec || 'copy'} `;
        if (profile.audioBitrate && profile.audioCodec !== 'copy') {
          cmd += `-b:a ${profile.audioBitrate} `;
        }

        if (profile.customParams) {
          cmd += `${profile.customParams} `;
        }
      }
    } else {
      cmd += `-c:v copy -c:a copy `;
    }

    // HLS output settings
    cmd += `-f hls `;
    cmd += `-hls_time 10 `;
    cmd += `-hls_list_size 6 `;
    cmd += `-hls_flags delete_segments+append_list `;
    cmd += `-hls_segment_filename "${segmentPattern}" `;
    cmd += `-hls_segment_type mpegts `;

    // Custom FFmpeg parameters
    if (stream.customFfmpeg) {
      cmd += `${stream.customFfmpeg} `;
    }

    // Output file and background execution
    cmd += `"${outputPath}" > /tmp/ffmpeg_${stream.id}.log 2>&1 & `;
    cmd += `echo "PID: $!"`;

    return cmd;
  }

  /**
   * Get stream URL from load balancer server
   */
  getRemoteStreamUrl(server: Server, streamId: number, ext: string): string {
    const protocol = server.serverPort === 443 ? 'https' : 'http';
    return `${protocol}://${server.serverUrl}:${server.serverPort}/tmp/streams/stream_${streamId}.${ext}`;
  }

  /**
   * Update server health metrics via SSH
   */
  async updateServerHealth(server: Server): Promise<void> {
    return new Promise((resolve) => {
      const ssh = new SSHClient();

      ssh.on('ready', () => {
        // Get CPU, memory, and bandwidth usage
        const cmd = `
          CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}');
          MEM=$(free | grep Mem | awk '{print ($3/$2) * 100.0}');
          CONNS=$(netstat -an | grep ESTABLISHED | wc -l);
          echo "CPU:$CPU MEM:$MEM CONNS:$CONNS"
        `;

        ssh.exec(cmd, (err, stream) => {
          if (err) {
            ssh.end();
            return resolve();
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('close', async () => {
            ssh.end();

            // Parse output
            const match = output.match(/CPU:([\d.]+) MEM:([\d.]+) CONNS:(\d+)/);
            if (match) {
              const cpuUsage = parseFloat(match[1]);
              const memoryUsage = parseFloat(match[2]);
              const connections = parseInt(match[3]);

              // Update database
              await storage.updateServer(server.id, {
                cpuUsage: parseFloat(cpuUsage.toFixed(2)),
                memoryUsage: parseFloat(memoryUsage.toFixed(2)),
                currentClients: connections,
                lastChecked: new Date(),
              } as any);

              console.log(`[LoadBalancer] Server ${server.serverName} - CPU: ${cpuUsage.toFixed(1)}%, MEM: ${memoryUsage.toFixed(1)}%, Connections: ${connections}`);
            }

            resolve();
          });
        });
      });

      ssh.on('error', () => {
        resolve();
      });

      const sshConfig: any = {
        host: server.sshHost || server.serverUrl,
        port: server.sshPort || 22,
        username: server.sshUsername || 'root',
      };

      if (server.sshPassword) {
        sshConfig.password = server.sshPassword;
      } else if (server.sshPrivateKey) {
        sshConfig.privateKey = server.sshPrivateKey;
      }

      ssh.connect(sshConfig);
    });
  }

  /**
   * Cleanup all remote processes
   */
  async cleanup(): Promise<void> {
    console.log('[LoadBalancer] Stopping all remote processes...');
    
    const stopPromises: Promise<void>[] = [];

    for (const [key, process] of this.remoteProcesses.entries()) {
      const server = await storage.getServer(process.serverId);
      if (server) {
        stopPromises.push(this.stopRemoteFFmpeg(server, process.streamId));
      }
    }

    await Promise.all(stopPromises);
    console.log('[LoadBalancer] Cleanup complete');
  }
}

// Singleton instance
export const loadBalancerManager = new LoadBalancerManager();
