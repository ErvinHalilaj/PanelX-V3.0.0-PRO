import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { ffmpegManager } from "./ffmpegManager";
import { loadBalancerManager } from "./loadBalancerManager";
import * as fs from 'fs';
import * as path from 'path';
import type { XtreamUserInfo, XtreamServerInfo, XtreamCategory, XtreamChannel, Line, Stream, Bouquet } from "@shared/schema";

/**
 * SECURITY NOTE ON PASSWORD HANDLING:
 * 
 * Xtream Codes API requires plain-text password transmission for compatibility 
 * with IPTV apps like TiviMate, IPTV Smarters, etc. These apps send raw 
 * username/password in API requests and expect the server to validate them.
 * 
 * While password hashing is security best practice, implementing it would break
 * compatibility with the entire Xtream Codes ecosystem. The passwords in this
 * system should be treated as API tokens rather than user passwords.
 * 
 * Recommendations for production:
 * 1. Use HTTPS to encrypt traffic
 * 2. Generate random, high-entropy passwords/tokens for lines
 * 3. Implement rate limiting on auth endpoints
 * 4. Use IP whitelisting where possible
 */

// Helper for XML escaping
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date for XMLTV
function formatXmltvDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())} +0000`;
}

// Detect player type from user agent
function detectPlayerType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('tivimate')) return 'TiviMate';
  if (ua.includes('smarters') || ua.includes('iptv smarters')) return 'Smarters';
  if (ua.includes('vlc')) return 'VLC';
  if (ua.includes('kodi') || ua.includes('xbmc')) return 'Kodi';
  if (ua.includes('tvheadend')) return 'TVHeadend';
  if (ua.includes('ffmpeg') || ua.includes('ffplay')) return 'FFmpeg';
  if (ua.includes('mpv')) return 'MPV';
  if (ua.includes('gse') || ua.includes('gse iptv')) return 'GSE IPTV';
  if (ua.includes('perfect player')) return 'Perfect Player';
  if (ua.includes('ottplayer') || ua.includes('ott')) return 'OTT Player';
  if (ua.includes('stb emu') || ua.includes('stbemu')) return 'STB Emu';
  if (ua.includes('xciptv')) return 'xcIPTV';
  if (ua.includes('sparkle tv')) return 'Sparkle TV';
  if (ua.includes('iptv pro')) return 'IPTV Pro';
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) return 'Browser';
  return 'Unknown';
}

// Get the server's base URL
function getServerInfo(req: Request): XtreamServerInfo {
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:5000';
  const [hostname, port] = host.split(':');
  
  return {
    url: hostname,
    port: port || '5000',
    https_port: '5000',
    server_protocol: protocol,
    rtmp_port: '1935',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace('T', ' ').split('.')[0],
  };
}

// Convert internal line to Xtream user info format
function lineToUserInfo(line: Line, activeConnections: number): XtreamUserInfo {
  return {
    username: line.username,
    password: line.password,
    message: '',
    auth: 1,
    status: line.enabled ? 'Active' : 'Banned',
    exp_date: line.expDate ? Math.floor(new Date(line.expDate).getTime() / 1000).toString() : '',
    is_trial: line.isTrial ? '1' : '0',
    active_cons: activeConnections.toString(),
    created_at: line.createdAt ? Math.floor(new Date(line.createdAt).getTime() / 1000).toString() : '',
    max_connections: (line.maxConnections || 1).toString(),
    allowed_output_formats: line.allowedOutputs || ['m3u8', 'ts'],
  };
}

// Convert internal category to Xtream format
function categoryToXtream(cat: { id: number; categoryName: string; parentId: number | null }): XtreamCategory {
  return {
    category_id: cat.id.toString(),
    category_name: cat.categoryName,
    parent_id: cat.parentId || 0,
  };
}

// Convert internal stream to Xtream channel format
function streamToXtreamChannel(stream: Stream, index: number): XtreamChannel {
  return {
    num: index + 1,
    name: stream.name,
    stream_type: stream.streamType || 'live',
    stream_id: stream.id,
    stream_icon: stream.streamIcon || '',
    epg_channel_id: stream.epgChannelId || null,
    added: stream.createdAt ? Math.floor(new Date(stream.createdAt).getTime() / 1000).toString() : '',
    category_id: (stream.categoryId || 1).toString(),
    tv_archive: 0,
    direct_source: stream.isDirect ? '1' : '',
    tv_archive_duration: 0,
  };
}

// Rate limiting configuration (in-memory cache for fast lookups)
const rateLimitCache: Map<string, { count: number; firstAttempt: number }> = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Check if IP is rate limited
async function isRateLimited(ipAddress: string): Promise<boolean> {
  // Check if IP is already blocked using optimized method
  const isBlocked = await storage.isIpBlocked(ipAddress);
  if (isBlocked) {
    return true;
  }
  
  // Check in-memory rate limit cache
  const cached = rateLimitCache.get(ipAddress);
  if (cached) {
    const now = Date.now();
    if (now - cached.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      // Window expired, reset
      rateLimitCache.delete(ipAddress);
      return false;
    }
    if (cached.count >= MAX_FAILED_ATTEMPTS) {
      return true;
    }
  }
  
  return false;
}

// Record a login attempt
async function recordLoginAttempt(ipAddress: string, username: string, success: boolean): Promise<void> {
  // Log to database for analytics
  try {
    await storage.logActivity({
      action: success ? 'auth_success' : 'auth_fail',
      ipAddress,
      details: `Username: ${username}`,
    });
  } catch (e) {
    // Ignore logging errors
  }
  
  if (success) {
    // Clear rate limit on successful auth
    rateLimitCache.delete(ipAddress);
    return;
  }
  
  // Track failed attempts in memory
  const cached = rateLimitCache.get(ipAddress);
  const now = Date.now();
  
  if (cached) {
    if (now - cached.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      // Window expired, reset
      rateLimitCache.set(ipAddress, { count: 1, firstAttempt: now });
    } else {
      cached.count++;
      
      // Auto-block if exceeded
      if (cached.count >= MAX_FAILED_ATTEMPTS) {
        const expiresAt = new Date(Date.now() + LOCKOUT_DURATION_MS);
        try {
          await storage.blockIp({
            ipAddress,
            reason: `Auto-blocked: ${cached.count} failed login attempts`,
            expiresAt,
            autoBlocked: true,
          });
          console.log(`[Rate Limit] Auto-blocked IP ${ipAddress} for excessive failed attempts`);
        } catch (e) {
          // IP might already be blocked
        }
      }
    }
  } else {
    rateLimitCache.set(ipAddress, { count: 1, firstAttempt: now });
  }
}

// Authenticate a line with rate limiting
async function authenticateLine(username: string, password: string, ipAddress?: string): Promise<Line | null> {
  const line = await storage.getLineByCredentials(username, password);
  
  // Record attempt
  if (ipAddress) {
    await recordLoginAttempt(ipAddress, username, !!line);
  }
  
  if (!line) return null;
  if (!line.enabled) return null;
  
  // Check expiration
  if (line.expDate && new Date(line.expDate) < new Date()) {
    return null;
  }
  
  return line;
}

// Get streams accessible by a line (based on bouquets)
async function getAccessibleStreams(line: Line, type: string = 'live'): Promise<Stream[]> {
  const allStreams = await storage.getStreams(undefined, type);
  const lineBouquets = line.bouquets || [];
  
  if (lineBouquets.length === 0) {
    // No bouquets assigned = access to all streams
    return allStreams;
  }
  
  // Get all bouquets assigned to this line
  const allBouquets = await storage.getBouquets();
  const assignedBouquets = allBouquets.filter(b => lineBouquets.includes(b.id));
  
  // Collect all stream IDs from assigned bouquets
  const accessibleStreamIds = new Set<number>();
  for (const bouquet of assignedBouquets) {
    const channels = bouquet.bouquetChannels || [];
    const movies = bouquet.bouquetMovies || [];
    channels.forEach(id => accessibleStreamIds.add(id));
    movies.forEach(id => accessibleStreamIds.add(id));
  }
  
  // Filter streams
  return allStreams.filter(s => accessibleStreamIds.has(s.id));
}

// Get categories that contain accessible streams
async function getAccessibleCategories(line: Line, type: string = 'live'): Promise<XtreamCategory[]> {
  const allCategories = await storage.getCategories();
  const accessibleStreams = await getAccessibleStreams(line, type);
  
  // Get unique category IDs from accessible streams
  const categoryIds = new Set(accessibleStreams.map(s => s.categoryId).filter(Boolean));
  
  // Filter categories
  const filtered = allCategories.filter(c => 
    c.categoryType === type && categoryIds.has(c.id)
  );
  
  return filtered.map(categoryToXtream);
}

export function registerPlayerApi(app: Express) {
  // ============================================
  // XTREAM CODES COMPATIBLE API
  // ============================================

  // player_api.php - Main API endpoint
  app.get('/player_api.php', async (req: Request, res: Response) => {
    const { username, password, action } = req.query;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check rate limiting before processing
    if (await isRateLimited(clientIp)) {
      console.log(`[Rate Limit] Blocked request from rate-limited IP: ${clientIp}`);
      return res.status(429).json({ 
        user_info: { auth: 0 },
        error: 'Too many failed attempts. Please try again later.'
      });
    }
    
    if (!username || !password) {
      return res.status(401).json({ user_info: { auth: 0 } });
    }
    
    const line = await authenticateLine(username as string, password as string, clientIp);
    
    if (!line) {
      return res.status(401).json({ user_info: { auth: 0 } });
    }

    // Get active connections for this line
    const connections = await storage.getConnectionsByLine(line.id);
    const serverInfo = getServerInfo(req);
    const userInfo = lineToUserInfo(line, connections.length);

    // Update last activity
    await storage.updateLine(line.id, { lastActivity: new Date() } as any);

    // Handle different actions
    switch (action) {
      case 'get_live_categories':
        const liveCategories = await getAccessibleCategories(line, 'live');
        return res.json(liveCategories);

      case 'get_vod_categories':
        const vodCategories = await getAccessibleCategories(line, 'movie');
        return res.json(vodCategories);

      case 'get_series_categories':
        const seriesCategories = await getAccessibleCategories(line, 'series');
        return res.json(seriesCategories);

      case 'get_live_streams':
        const categoryId = req.query.category_id;
        let liveStreams = await getAccessibleStreams(line, 'live');
        if (categoryId) {
          liveStreams = liveStreams.filter(s => s.categoryId === parseInt(categoryId as string));
        }
        return res.json(liveStreams.map((s, i) => streamToXtreamChannel(s, i)));

      case 'get_vod_streams':
        const vodCatId = req.query.category_id;
        let vodStreams = await getAccessibleStreams(line, 'movie');
        if (vodCatId) {
          vodStreams = vodStreams.filter(s => s.categoryId === parseInt(vodCatId as string));
        }
        return res.json(vodStreams.map((s, i) => streamToXtreamChannel(s, i)));

      case 'get_series':
        const seriesCatId = req.query.category_id;
        let seriesList = await storage.getSeries(seriesCatId ? parseInt(seriesCatId as string) : undefined);
        return res.json(seriesList.map(s => ({
          series_id: s.id,
          name: s.name,
          cover: s.cover || '',
          plot: s.plot || '',
          cast: s.cast || '',
          director: s.director || '',
          genre: s.genre || '',
          releaseDate: s.releaseDate || '',
          last_modified: s.lastModified ? new Date(s.lastModified).toISOString() : '',
          rating: s.rating || '0',
          rating_5based: parseFloat(s.rating || '0') / 2,
          backdrop_path: s.backdrop ? [s.backdrop] : [],
          youtube_trailer: s.youtubeTrailer || '',
          episode_run_time: '',
          category_id: s.categoryId?.toString() || '',
        })));

      case 'get_series_info':
        const seriesIdQuery = req.query.series_id;
        if (!seriesIdQuery) {
          return res.status(400).json({ error: 'Missing series_id' });
        }
        const seriesInfo = await storage.getSeriesById(parseInt(seriesIdQuery as string));
        if (!seriesInfo) {
          return res.status(404).json({ error: 'Series not found' });
        }
        const episodesList = await storage.getEpisodes(seriesInfo.id);
        
        // Group episodes by season
        const seasons: Record<string, any[]> = {};
        for (const ep of episodesList) {
          const seasonKey = ep.seasonNum.toString();
          if (!seasons[seasonKey]) seasons[seasonKey] = [];
          seasons[seasonKey].push({
            id: ep.id.toString(),
            episode_num: ep.episodeNum,
            title: ep.title,
            container_extension: 'mp4',
            info: {
              duration_secs: ep.duration || 0,
              duration: ep.duration ? `${Math.floor(ep.duration / 60)}` : '',
              movie_image: ep.cover || '',
              plot: ep.plot || '',
              releasedate: ep.releaseDate || '',
              rating: 0,
            },
            custom_sid: '',
            added: ep.addedAt ? Math.floor(new Date(ep.addedAt).getTime() / 1000).toString() : '',
            season: ep.seasonNum,
            direct_source: ep.sourceUrl || '',
          });
        }

        return res.json({
          seasons: Object.keys(seasons).sort((a, b) => parseInt(a) - parseInt(b)),
          info: {
            name: seriesInfo.name,
            cover: seriesInfo.cover || '',
            plot: seriesInfo.plot || '',
            cast: seriesInfo.cast || '',
            director: seriesInfo.director || '',
            genre: seriesInfo.genre || '',
            releaseDate: seriesInfo.releaseDate || '',
            rating: seriesInfo.rating || '0',
            backdrop_path: seriesInfo.backdrop ? [seriesInfo.backdrop] : [],
            youtube_trailer: seriesInfo.youtubeTrailer || '',
            episode_run_time: '',
            category_id: seriesInfo.categoryId?.toString() || '',
          },
          episodes: seasons,
        });

      case 'get_vod_info':
        const vodIdQuery = req.query.vod_id;
        if (!vodIdQuery) {
          return res.status(400).json({ error: 'Missing vod_id' });
        }
        const vodStreamId = parseInt(vodIdQuery as string);
        const vodStream = await storage.getStream(vodStreamId);
        if (!vodStream) {
          return res.status(404).json({ error: 'VOD not found' });
        }
        const vodMeta = await storage.getVodInfo(vodStreamId);
        
        return res.json({
          info: {
            kinopoisk_url: '',
            tmdb_id: vodMeta?.tmdbId || '',
            name: vodStream.name,
            o_name: vodStream.name,
            cover_big: vodMeta?.backdrop || vodStream.streamIcon || '',
            movie_image: vodStream.streamIcon || '',
            releasedate: vodMeta?.releaseDate || '',
            episode_run_time: vodMeta?.duration ? `${Math.floor(vodMeta.duration / 60)}` : '',
            youtube_trailer: vodMeta?.youtubeTrailer || '',
            director: vodMeta?.director || '',
            actors: vodMeta?.cast || '',
            cast: vodMeta?.cast || '',
            description: vodMeta?.plot || '',
            plot: vodMeta?.plot || '',
            genre: vodMeta?.genre || '',
            rating: vodMeta?.rating || '',
            rating_5based: parseFloat(vodMeta?.rating || '0') / 2,
            country: '',
            duration_secs: vodMeta?.duration || 0,
            duration: vodMeta?.duration ? `${Math.floor(vodMeta.duration / 60)}` : '',
            video: {},
            audio: {},
            bitrate: 0,
            subtitles: vodMeta?.subtitles || [],
          },
          movie_data: {
            stream_id: vodStream.id,
            name: vodStream.name,
            added: vodStream.createdAt ? Math.floor(new Date(vodStream.createdAt).getTime() / 1000).toString() : '',
            category_id: vodStream.categoryId?.toString() || '',
            container_extension: 'mp4',
            custom_sid: '',
            direct_source: vodStream.sourceUrl,
          },
        });

      case 'get_short_epg':
      case 'get_simple_data_table':
        const epgStreamId = req.query.stream_id;
        const epgLimit = parseInt(req.query.limit as string) || 10;
        if (!epgStreamId) {
          return res.json({ epg_listings: [] });
        }
        const epgStream = await storage.getStream(parseInt(epgStreamId as string));
        if (!epgStream || !epgStream.epgChannelId) {
          return res.json({ epg_listings: [] });
        }
        const now = new Date();
        const epgEntries = await storage.getEpgData(epgStream.epgChannelId, now);
        return res.json({
          epg_listings: epgEntries.slice(0, epgLimit).map(e => ({
            id: e.id.toString(),
            epg_id: e.channelId,
            title: btoa(e.title || ''),
            lang: e.lang || 'en',
            start: e.startTime ? new Date(e.startTime).toISOString().replace('T', ' ').split('.')[0] : '',
            end: e.endTime ? new Date(e.endTime).toISOString().replace('T', ' ').split('.')[0] : '',
            description: btoa(e.description || ''),
            channel_id: epgStream.epgChannelId,
            start_timestamp: e.startTime ? Math.floor(new Date(e.startTime).getTime() / 1000) : 0,
            stop_timestamp: e.endTime ? Math.floor(new Date(e.endTime).getTime() / 1000) : 0,
          })),
        });

      default:
        // Default: Return user info and server info
        await storage.logActivity({
          lineId: line.id,
          action: 'auth_success',
          ipAddress: req.ip || '',
          userAgent: req.get('user-agent') || '',
        });
        
        return res.json({
          user_info: userInfo,
          server_info: serverInfo,
        });
    }
  });

  // GET.php - Stream URL endpoint (for M3U playlist generation)
  app.get('/get.php', async (req: Request, res: Response) => {
    const { username, password, type, output } = req.query;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check rate limiting
    if (await isRateLimited(clientIp)) {
      return res.status(429).send('Too many failed attempts');
    }
    
    if (!username || !password) {
      return res.status(401).send('Unauthorized');
    }
    
    const line = await authenticateLine(username as string, password as string, clientIp);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    const serverInfo = getServerInfo(req);
    const baseUrl = `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}`;
    
    // Generate M3U playlist
    if (type === 'm3u_plus' || type === 'm3u') {
      const streams = await getAccessibleStreams(line, 'live');
      const categories = await storage.getCategories();
      
      let m3u = '#EXTM3U\n';
      
      for (const stream of streams) {
        const category = categories.find(c => c.id === stream.categoryId);
        const categoryName = category?.categoryName || 'Uncategorized';
        
        m3u += `#EXTINF:-1 tvg-id="${stream.epgChannelId || ''}" tvg-name="${stream.name}" tvg-logo="${stream.streamIcon || ''}" group-title="${categoryName}",${stream.name}\n`;
        m3u += `${baseUrl}/live/${username}/${password}/${stream.id}.${output || 'ts'}\n`;
      }
      
      res.setHeader('Content-Type', 'application/x-mpegurl');
      res.setHeader('Content-Disposition', `attachment; filename="${username}.m3u"`);
      return res.send(m3u);
    }

    return res.status(400).send('Invalid request');
  });

  // Live stream endpoint
  app.get('/live/:username/:password/:streamId.:ext', async (req: Request, res: Response) => {
    const { username, password, streamId } = req.params;
    
    const line = await authenticateLine(username, password);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    // Check connection limit
    const connections = await storage.getConnectionsByLine(line.id);
    if (connections.length >= (line.maxConnections || 1)) {
      return res.status(403).send('Max connections reached');
    }

    // Check allowed domains restriction
    const lineAllowedDomains = line.allowedDomains as string[] | null;
    if (lineAllowedDomains && lineAllowedDomains.length > 0) {
      const requestHost = req.get('host') || req.get('origin') || '';
      const isAllowed = lineAllowedDomains.some(domain => 
        requestHost.includes(domain) || domain === '*'
      );
      if (!isAllowed) {
        return res.status(403).send('Domain not allowed');
      }
    }

    // Get the stream
    const stream = await storage.getStream(parseInt(streamId));
    
    if (!stream) {
      return res.status(404).send('Stream not found');
    }

    // Check if user has access to this stream
    const accessibleStreams = await getAccessibleStreams(line);
    if (!accessibleStreams.find(s => s.id === stream.id)) {
      return res.status(403).send('Access denied');
    }

    // Create connection record
    const connection = await storage.createConnection({
      lineId: line.id,
      streamId: stream.id,
      userAgent: req.get('user-agent') || '',
      ipAddress: req.ip || '',
    });

    // Track connection history for analytics
    const connectionStartTime = Date.now();
    let connectionHistoryId: number | null = null;
    try {
      const historyEntry = await storage.createConnectionHistory({
        lineId: line.id,
        streamId: stream.id,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
        playerType: detectPlayerType(req.get('user-agent') || ''),
      });
      connectionHistoryId = historyEntry.id;
    } catch (e) {
      console.error('Failed to create connection history:', e);
    }

    // Update most watched analytics
    try {
      await storage.updateMostWatched(stream.id, stream.streamType || 'live');
    } catch (e) {
      console.error('Failed to update most watched:', e);
    }

    // Log activity
    await storage.logActivity({
      lineId: line.id,
      action: 'stream_start',
      streamId: stream.id,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    const ext = req.params.ext?.toLowerCase() || 'ts';
    const sourceUrl = stream.sourceUrl;

    // Cleanup on client disconnect
    req.on('close', async () => {
      await storage.deleteConnection(connection.id);
      
      // Track viewer disconnect for On-Demand mode
      await ffmpegManager.onViewerDisconnect(stream.id);
      
      // Update connection history with duration
      if (connectionHistoryId) {
        const durationSeconds = Math.floor((Date.now() - connectionStartTime) / 1000);
        try {
          await storage.updateConnectionHistory(connectionHistoryId, {
            duration: durationSeconds,
          });
        } catch (e) {
          console.error('Failed to update connection history duration:', e);
        }
      }
      
      await storage.logActivity({
        lineId: line.id,
        action: 'stream_stop',
        streamId: stream.id,
        ipAddress: req.ip || '',
      });
    });

    // Track viewer connection for On-Demand mode
    await ffmpegManager.onViewerConnect(stream.id);

    // Decision 1: Check if stream should use load balancer
    const loadBalancerServer = await loadBalancerManager.selectServer(stream, req.ip);
    
    if (loadBalancerServer && !loadBalancerServer.isMainServer) {
      // Route through load balancer server
      console.log(`[Stream ${stream.id}] Routing through load balancer: ${loadBalancerServer.serverName}`);
      
      // Check if FFmpeg is running on remote server
      const isRunning = await loadBalancerManager.isRemoteFFmpegRunning(loadBalancerServer, stream.id);
      
      if (!isRunning && stream.onDemand) {
        console.log(`[Stream ${stream.id}] Starting remote FFmpeg...`);
        try {
          await loadBalancerManager.startRemoteFFmpeg(loadBalancerServer, stream);
        } catch (err) {
          console.error(`[Stream ${stream.id}] Failed to start remote FFmpeg:`, err);
          // Fallback to local processing
        }
      }

      // Redirect to load balancer server
      const remoteUrl = loadBalancerManager.getRemoteStreamUrl(loadBalancerServer, stream.id, ext);
      return res.redirect(remoteUrl);
    }

    // Decision 2: Direct stream vs Transcoded stream (local)
    if (ext === 'ts' && stream.isDirect) {
      // Direct TS stream - redirect to source
      console.log(`[Stream ${stream.id}] Direct redirect to source`);
      return res.redirect(sourceUrl);
    }

    if (ext === 'm3u8' || (!stream.isDirect && ext === 'ts')) {
      // HLS stream - serve through FFmpeg
      console.log(`[Stream ${stream.id}] Serving HLS through FFmpeg`);
      
      // Check if FFmpeg is running
      if (!ffmpegManager.isRunning(stream.id)) {
        console.log(`[Stream ${stream.id}] Starting FFmpeg process...`);
        try {
          await ffmpegManager.startStream(stream.id);
        } catch (err) {
          console.error(`[Stream ${stream.id}] Failed to start FFmpeg:`, err);
          return res.status(502).send('Stream unavailable');
        }
      }

      // Serve HLS playlist
      const hlsPath = ffmpegManager.getOutputPath(stream.id);
      
      // Wait for file to exist (with timeout) - only if just started
      if (!fs.existsSync(hlsPath)) {
        let attempts = 0;
        while (!fs.existsSync(hlsPath) && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!fs.existsSync(hlsPath)) {
          return res.status(502).send('Stream not ready');
        }
      }

      // Set proper headers for HLS
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      return res.sendFile(hlsPath);
    }

    // Fallback: redirect to source
    return res.redirect(sourceUrl);
  });

  // HLS segment endpoint (serves .ts segments)
  app.get('/streams/:filename', async (req: Request, res: Response) => {
    const { filename } = req.params;
    
    // Security: only allow .ts and .m3u8 files
    if (!filename.endsWith('.ts') && !filename.endsWith('.m3u8')) {
      return res.status(403).send('Forbidden');
    }

    // Get full path
    const segmentPath = path.join(process.cwd(), 'streams', filename);

    if (!fs.existsSync(segmentPath)) {
      return res.status(404).send('Segment not found');
    }

    // Set appropriate content type
    const contentType = filename.endsWith('.m3u8') 
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(segmentPath);
  });

  // Movie/VOD stream endpoint
  app.get('/movie/:username/:password/:streamId.:ext', async (req: Request, res: Response) => {
    const { username, password, streamId } = req.params;
    
    const line = await authenticateLine(username, password);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    // Check connection limit
    const connections = await storage.getConnectionsByLine(line.id);
    if (connections.length >= (line.maxConnections || 1)) {
      return res.status(403).send('Max connections reached');
    }

    // Check allowed domains restriction
    const movieAllowedDomains = line.allowedDomains as string[] | null;
    if (movieAllowedDomains && movieAllowedDomains.length > 0) {
      const requestHost = req.get('host') || req.get('origin') || '';
      const isAllowed = movieAllowedDomains.some(domain => 
        requestHost.includes(domain) || domain === '*'
      );
      if (!isAllowed) {
        return res.status(403).send('Domain not allowed');
      }
    }

    // Get the stream
    const stream = await storage.getStream(parseInt(streamId));
    
    if (!stream || stream.streamType !== 'movie') {
      return res.status(404).send('Movie not found');
    }

    // Check if user has access to this stream
    const accessibleStreams = await getAccessibleStreams(line, 'movie');
    if (!accessibleStreams.find(s => s.id === stream.id)) {
      return res.status(403).send('Access denied');
    }

    // Create connection record
    const connection = await storage.createConnection({
      lineId: line.id,
      streamId: stream.id,
      userAgent: req.get('user-agent') || '',
      ipAddress: req.ip || '',
    });

    // Track connection history for analytics
    const vodStartTime = Date.now();
    let vodHistoryId: number | null = null;
    try {
      const historyEntry = await storage.createConnectionHistory({
        lineId: line.id,
        streamId: stream.id,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
        playerType: detectPlayerType(req.get('user-agent') || ''),
      });
      vodHistoryId = historyEntry.id;
    } catch (e) {
      console.error('Failed to create VOD connection history:', e);
    }

    // Update most watched analytics for movies
    try {
      await storage.updateMostWatched(stream.id, 'movie');
    } catch (e) {
      console.error('Failed to update movie most watched:', e);
    }

    // Log activity
    await storage.logActivity({
      lineId: line.id,
      action: 'vod_start',
      streamId: stream.id,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    // Cleanup on disconnect
    req.on('close', async () => {
      await storage.deleteConnection(connection.id);
      
      // Update connection history with duration
      if (vodHistoryId) {
        const durationSeconds = Math.floor((Date.now() - vodStartTime) / 1000);
        try {
          await storage.updateConnectionHistory(vodHistoryId, { duration: durationSeconds });
        } catch (e) {
          console.error('Failed to update VOD connection history duration:', e);
        }
      }
    });

    // Redirect to source
    return res.redirect(stream.sourceUrl);
  });

  // Series episode stream endpoint
  app.get('/series/:username/:password/:episodeId.:ext', async (req: Request, res: Response) => {
    const { username, password, episodeId } = req.params;
    
    const line = await authenticateLine(username, password);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    // Check connection limit
    const connections = await storage.getConnectionsByLine(line.id);
    if (connections.length >= (line.maxConnections || 1)) {
      return res.status(403).send('Max connections reached');
    }

    // Check allowed domains restriction
    const seriesAllowedDomains = line.allowedDomains as string[] | null;
    if (seriesAllowedDomains && seriesAllowedDomains.length > 0) {
      const requestHost = req.get('host') || req.get('origin') || '';
      const isAllowed = seriesAllowedDomains.some(domain => 
        requestHost.includes(domain) || domain === '*'
      );
      if (!isAllowed) {
        return res.status(403).send('Domain not allowed');
      }
    }

    // Get the episode
    const episode = await storage.getEpisode(parseInt(episodeId));
    
    if (!episode) {
      return res.status(404).send('Episode not found');
    }

    // Create connection record
    const connection = await storage.createConnection({
      lineId: line.id,
      streamId: episode.seriesId, // Reference series
      userAgent: req.get('user-agent') || '',
      ipAddress: req.ip || '',
    });

    // Track connection history for analytics
    const seriesStartTime = Date.now();
    let seriesHistoryId: number | null = null;
    try {
      const historyEntry = await storage.createConnectionHistory({
        lineId: line.id,
        streamId: episode.seriesId,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
        playerType: detectPlayerType(req.get('user-agent') || ''),
      });
      seriesHistoryId = historyEntry.id;
    } catch (e) {
      console.error('Failed to create series connection history:', e);
    }

    // Update most watched analytics for series
    try {
      await storage.updateMostWatched(episode.seriesId, 'series');
    } catch (e) {
      console.error('Failed to update series most watched:', e);
    }

    // Log activity
    await storage.logActivity({
      lineId: line.id,
      action: 'series_start',
      streamId: episode.seriesId,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      details: `Episode ${episode.seasonNum}x${episode.episodeNum}`,
    });

    // Cleanup on disconnect
    req.on('close', async () => {
      await storage.deleteConnection(connection.id);
      
      // Update connection history with duration
      if (seriesHistoryId) {
        const durationSeconds = Math.floor((Date.now() - seriesStartTime) / 1000);
        try {
          await storage.updateConnectionHistory(seriesHistoryId, { duration: durationSeconds });
        } catch (e) {
          console.error('Failed to update series connection history duration:', e);
        }
      }
    });

    // Redirect to source
    return res.redirect(episode.sourceUrl || '');
  });

  // XMLTV EPG endpoint
  app.get('/xmltv.php', async (req: Request, res: Response) => {
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(401).send('Unauthorized');
    }
    
    const line = await authenticateLine(username as string, password as string);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    // Get accessible live streams
    const liveStreams = await getAccessibleStreams(line, 'live');
    const channelIds = liveStreams.filter(s => s.epgChannelId).map(s => s.epgChannelId!);
    
    // Generate XMLTV format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n';
    xml += '<tv generator-info-name="PanelX IPTV">\n';
    
    // Add channels
    for (const stream of liveStreams) {
      if (stream.epgChannelId) {
        xml += `  <channel id="${stream.epgChannelId}">\n`;
        xml += `    <display-name>${escapeXml(stream.name)}</display-name>\n`;
        if (stream.streamIcon) {
          xml += `    <icon src="${escapeXml(stream.streamIcon)}" />\n`;
        }
        xml += `  </channel>\n`;
      }
    }
    
    // Add programmes for each channel
    for (const channelId of channelIds) {
      const now = new Date();
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const epgEntries = await storage.getEpgData(channelId, now, endDate);
      
      for (const entry of epgEntries) {
        const start = entry.startTime ? formatXmltvDate(new Date(entry.startTime)) : '';
        const stop = entry.endTime ? formatXmltvDate(new Date(entry.endTime)) : '';
        
        xml += `  <programme start="${start}" stop="${stop}" channel="${channelId}">\n`;
        xml += `    <title lang="${entry.lang || 'en'}">${escapeXml(entry.title || '')}</title>\n`;
        if (entry.description) {
          xml += `    <desc lang="${entry.lang || 'en'}">${escapeXml(entry.description)}</desc>\n`;
        }
        if (entry.category) {
          xml += `    <category>${escapeXml(entry.category)}</category>\n`;
        }
        xml += `  </programme>\n`;
      }
    }
    
    xml += '</tv>';
    
    res.setHeader('Content-Type', 'application/xml');
    return res.send(xml);
  });

  // Timeshift/TV Archive endpoint
  app.get('/timeshift/:username/:password/:duration/:start/:streamId.:ext', async (req: Request, res: Response) => {
    const { username, password, duration, start, streamId } = req.params;
    
    const line = await authenticateLine(username, password);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    const stream = await storage.getStream(parseInt(streamId));
    
    if (!stream || !stream.tvArchiveEnabled) {
      return res.status(404).send('Archive not available');
    }

    // Find archive entry
    const startTime = new Date(parseInt(start) * 1000);
    const archives = await storage.getTvArchiveEntries(stream.id, startTime);
    
    if (archives.length === 0) {
      return res.status(404).send('Archive not found');
    }

    const archive = archives[0];
    
    // Log activity
    await storage.logActivity({
      lineId: line.id,
      action: 'timeshift_start',
      streamId: stream.id,
      ipAddress: req.ip || '',
      details: `Archive from ${startTime.toISOString()}`,
    });

    return res.redirect(archive.archiveFile);
  });

  // Catchup endpoint (alternative format)
  app.get('/streaming/timeshift.php', async (req: Request, res: Response) => {
    const { username, password, stream, start, duration } = req.query;
    
    if (!username || !password || !stream) {
      return res.status(400).send('Missing parameters');
    }
    
    const line = await authenticateLine(username as string, password as string);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    const streamData = await storage.getStream(parseInt(stream as string));
    
    if (!streamData || !streamData.tvArchiveEnabled) {
      return res.status(404).send('Archive not available');
    }

    const startTime = start ? new Date(parseInt(start as string) * 1000) : new Date();
    const archives = await storage.getTvArchiveEntries(streamData.id, startTime);
    
    if (archives.length === 0) {
      return res.status(404).send('Archive not found');
    }

    return res.redirect(archives[0].archiveFile);
  });

  // Panel info endpoint (for compatibility)
  app.get('/panel_api.php', async (req: Request, res: Response) => {
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // This would typically be admin/reseller authentication
    const user = await storage.getUserByUsername(username as string);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await storage.getStats();
    
    return res.json({
      user_info: {
        username: user.username,
        role: user.role,
        credits: user.credits,
      },
      server_info: getServerInfo(req),
      stats,
    });
  });

  // ============================================
  // STALKER PORTAL API (for MAG devices)
  // ============================================
  
  app.all('/stalker_portal/c/', async (req: Request, res: Response) => {
    return res.redirect('/stalker_portal/server/load.php');
  });

  app.all('/stalker_portal/server/load.php', async (req: Request, res: Response) => {
    const { type, action, mac } = { ...req.query, ...req.body };
    const serverInfo = getServerInfo(req);

    // Handle handshake
    if (type === 'stb' && action === 'handshake') {
      return res.json({
        js: {
          token: Buffer.from(`${Date.now()}`).toString('base64'),
          random: Math.random().toString(36).substring(7),
        },
      });
    }

    // Handle STB profile
    if (type === 'stb' && action === 'get_profile') {
      return res.json({
        js: {
          id: 1,
          name: 'PanelX',
          logo: '',
          portal_url: `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}/stalker_portal/c/`,
          mac: mac || '',
          ip: '',
          ls: true,
          version: '1.0',
          stb_type: 'MAG250',
          num_banks: 0,
          time_zone: serverInfo.timezone,
          limit_id: '',
        },
      });
    }

    // Handle authorization
    if (type === 'stb' && action === 'do_auth') {
      const login = req.body.login || req.query.login;
      const password = req.body.password || req.query.password;
      
      if (!login || !password) {
        return res.json({ js: false, error: 'Missing credentials' });
      }
      
      const line = await authenticateLine(login as string, password as string);
      
      if (!line) {
        return res.json({ js: false, error: 'Invalid credentials' });
      }
      
      return res.json({
        js: {
          id: line.id,
          mac: mac || '',
          login: line.username,
          status: line.enabled ? 1 : 0,
        },
      });
    }

    // Handle IPTV categories
    if (type === 'itv' && action === 'get_genres') {
      const categories = await storage.getCategories();
      const liveCategories = categories.filter(c => c.categoryType === 'live');
      
      return res.json({
        js: liveCategories.map((c, i) => ({
          id: c.id.toString(),
          title: c.categoryName,
          alias: c.categoryName.toLowerCase().replace(/\s+/g, '_'),
          number: (i + 1).toString(),
          censored: 0,
        })),
      });
    }

    // Handle IPTV channels
    if (type === 'itv' && action === 'get_ordered_list') {
      const genre = req.query.genre || req.body.genre;
      const p = parseInt(req.query.p as string) || 1;
      const limit = 50;
      
      let allStreams = await storage.getStreams(undefined, 'live');
      
      if (genre && genre !== '*') {
        allStreams = allStreams.filter(s => s.categoryId === parseInt(genre as string));
      }
      
      const total = allStreams.length;
      const streams = allStreams.slice((p - 1) * limit, p * limit);
      
      return res.json({
        js: {
          total_items: total,
          max_page_items: limit,
          cur_page: p,
          selected_item: 0,
          data: streams.map((s, i) => ({
            id: s.id.toString(),
            name: s.name,
            number: ((p - 1) * limit + i + 1).toString(),
            cmd: `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}/live/portal/${s.id}.ts`,
            logo: s.streamIcon || '',
            genre_id: s.categoryId?.toString() || '',
            tv_archive: s.tvArchiveEnabled ? 1 : 0,
            tv_archive_duration: s.tvArchiveDuration || 0,
          })),
        },
      });
    }

    // Handle VOD categories
    if (type === 'vod' && action === 'get_categories') {
      const categories = await storage.getCategories();
      const vodCategories = categories.filter(c => c.categoryType === 'movie');
      
      return res.json({
        js: vodCategories.map((c, i) => ({
          id: c.id.toString(),
          title: c.categoryName,
          alias: c.categoryName.toLowerCase().replace(/\s+/g, '_'),
          number: (i + 1).toString(),
        })),
      });
    }

    // Handle VOD list
    if (type === 'vod' && action === 'get_ordered_list') {
      const category = req.query.category || req.body.category;
      const p = parseInt(req.query.p as string) || 1;
      const limit = 50;
      
      let allStreams = await storage.getStreams(undefined, 'movie');
      
      if (category && category !== '*') {
        allStreams = allStreams.filter(s => s.categoryId === parseInt(category as string));
      }
      
      const total = allStreams.length;
      const streams = allStreams.slice((p - 1) * limit, p * limit);
      
      return res.json({
        js: {
          total_items: total,
          max_page_items: limit,
          cur_page: p,
          data: streams.map(s => ({
            id: s.id.toString(),
            name: s.name,
            o_name: s.name,
            screenshot_uri: s.streamIcon || '',
            cmd: `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}/movie/portal/${s.id}.mp4`,
          })),
        },
      });
    }

    // Default response
    return res.json({ js: {} });
  });

  // Portal live stream
  app.get('/live/portal/:streamId.:ext', async (req: Request, res: Response) => {
    const { streamId } = req.params;
    const stream = await storage.getStream(parseInt(streamId));
    
    if (!stream) {
      return res.status(404).send('Stream not found');
    }
    
    return res.redirect(stream.sourceUrl);
  });

  // Portal movie stream
  app.get('/movie/portal/:streamId.:ext', async (req: Request, res: Response) => {
    const { streamId } = req.params;
    const stream = await storage.getStream(parseInt(streamId));
    
    if (!stream || stream.streamType !== 'movie') {
      return res.status(404).send('Movie not found');
    }
    
    return res.redirect(stream.sourceUrl);
  });

  // ============================================
  // ENIGMA2 API (for Enigma2/Dreambox devices)
  // ============================================
  
  app.get('/get.php', async (req: Request, res: Response) => {
    const { username, password, type, output } = req.query;
    
    if (!username || !password) {
      return res.status(401).send('Unauthorized');
    }
    
    const line = await authenticateLine(username as string, password as string);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    const serverInfo = getServerInfo(req);
    const baseUrl = `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}`;

    // Enigma2 bouquet format
    if (type === 'enigma2_bouquet' || type === 'enigma2') {
      const streams = await getAccessibleStreams(line, 'live');
      const categories = await storage.getCategories();
      
      let e2bouquet = '#NAME PanelX IPTV\n';
      
      for (const stream of streams) {
        const category = categories.find(c => c.id === stream.categoryId);
        const categoryName = category?.categoryName || 'Uncategorized';
        const serviceName = `${stream.name} [${categoryName}]`;
        const streamUrl = `${baseUrl}/live/${username}/${password}/${stream.id}.ts`;
        
        e2bouquet += `#SERVICE 4097:0:1:0:0:0:0:0:0:0:${encodeURIComponent(streamUrl)}:${serviceName}\n`;
        e2bouquet += `#DESCRIPTION ${stream.name}\n`;
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${username}_enigma2.tv"`);
      return res.send(e2bouquet);
    }
    
    // M3U playlist format
    if (type === 'm3u_plus' || type === 'm3u') {
      const streams = await getAccessibleStreams(line, 'live');
      const categories = await storage.getCategories();
      
      let m3u = '#EXTM3U\n';
      
      for (const stream of streams) {
        const category = categories.find(c => c.id === stream.categoryId);
        const categoryName = category?.categoryName || 'Uncategorized';
        
        m3u += `#EXTINF:-1 tvg-id="${stream.epgChannelId || ''}" tvg-name="${stream.name}" tvg-logo="${stream.streamIcon || ''}" group-title="${categoryName}",${stream.name}\n`;
        m3u += `${baseUrl}/live/${username}/${password}/${stream.id}.${output || 'ts'}\n`;
      }
      
      res.setHeader('Content-Type', 'application/x-mpegurl');
      res.setHeader('Content-Disposition', `attachment; filename="${username}.m3u"`);
      return res.send(m3u);
    }

    return res.status(400).send('Invalid request');
  });

  // ============================================
  // DEVICE PLAYLIST GENERATOR
  // ============================================
  
  app.get('/playlist/:deviceKey/:username/:password', async (req: Request, res: Response) => {
    const { deviceKey, username, password } = req.params;
    
    const line = await authenticateLine(username, password);
    
    if (!line) {
      return res.status(401).send('Unauthorized');
    }

    const template = await storage.getDeviceTemplate(deviceKey);
    
    if (!template) {
      // Fall back to standard M3U
      const serverInfo = getServerInfo(req);
      const baseUrl = `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}`;
      const streams = await getAccessibleStreams(line, 'live');
      const categories = await storage.getCategories();
      
      let m3u = '#EXTM3U\n';
      
      for (const stream of streams) {
        const category = categories.find(c => c.id === stream.categoryId);
        const categoryName = category?.categoryName || 'Uncategorized';
        
        m3u += `#EXTINF:-1 tvg-id="${stream.epgChannelId || ''}" tvg-name="${stream.name}" tvg-logo="${stream.streamIcon || ''}" group-title="${categoryName}",${stream.name}\n`;
        m3u += `${baseUrl}/live/${username}/${password}/${stream.id}.ts\n`;
      }
      
      res.setHeader('Content-Type', 'application/x-mpegurl');
      return res.send(m3u);
    }

    const serverInfo = getServerInfo(req);
    const baseUrl = `${serverInfo.server_protocol}://${serverInfo.url}:${serverInfo.port}`;
    const streams = await getAccessibleStreams(line, 'live');
    const categories = await storage.getCategories();
    
    // Apply template
    let playlist = (template.headerTemplate || '#EXTM3U').replace(/{username}/g, username).replace(/{password}/g, password).replace(/{server}/g, baseUrl) + '\n';
    
    for (const stream of streams) {
      const category = categories.find(c => c.id === stream.categoryId);
      let line = template.lineTemplate
        .replace(/{stream_id}/g, stream.id.toString())
        .replace(/{stream_name}/g, stream.name)
        .replace(/{stream_icon}/g, stream.streamIcon || '')
        .replace(/{epg_channel_id}/g, stream.epgChannelId || '')
        .replace(/{category_name}/g, category?.categoryName || 'Uncategorized')
        .replace(/{username}/g, username)
        .replace(/{password}/g, password)
        .replace(/{server}/g, baseUrl)
        .replace(/{extension}/g, template.fileExtension || 'ts');
      
      playlist += line + '\n';
    }
    
    res.setHeader('Content-Type', 'application/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${username}.m3u"`);
    return res.send(playlist);
  });
}
