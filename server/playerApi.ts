import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import type { XtreamUserInfo, XtreamServerInfo, XtreamCategory, XtreamChannel, Line, Stream, Bouquet } from "@shared/schema";

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

// Authenticate a line
async function authenticateLine(username: string, password: string): Promise<Line | null> {
  const line = await storage.getLineByCredentials(username, password);
  
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
    
    if (!username || !password) {
      return res.status(401).json({ user_info: { auth: 0 } });
    }
    
    const line = await authenticateLine(username as string, password as string);
    
    if (!line) {
      // Log failed auth attempt
      await storage.logActivity({
        lineId: null,
        action: 'auth_fail',
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
        details: `Failed login for user: ${username}`,
      });
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
        let series = await getAccessibleStreams(line, 'series');
        if (seriesCatId) {
          series = series.filter(s => s.categoryId === parseInt(seriesCatId as string));
        }
        return res.json(series.map((s, i) => streamToXtreamChannel(s, i)));

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
    
    if (!username || !password) {
      return res.status(401).send('Unauthorized');
    }
    
    const line = await authenticateLine(username as string, password as string);
    
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

    // Log activity
    await storage.logActivity({
      lineId: line.id,
      action: 'stream_start',
      streamId: stream.id,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    // For now, redirect to source URL (basic proxy)
    // In production, you'd pipe through FFmpeg here
    if (stream.isDirect) {
      return res.redirect(stream.sourceUrl);
    }

    // Simple proxy - fetch and pipe
    try {
      const response = await fetch(stream.sourceUrl);
      if (!response.ok) {
        await storage.deleteConnection(connection.id);
        return res.status(502).send('Stream unavailable');
      }

      res.setHeader('Content-Type', 'video/mp2t');
      
      const reader = response.body?.getReader();
      if (!reader) {
        await storage.deleteConnection(connection.id);
        return res.status(502).send('Stream unavailable');
      }

      // Cleanup on client disconnect
      req.on('close', async () => {
        await storage.deleteConnection(connection.id);
        await storage.logActivity({
          lineId: line.id,
          action: 'stream_stop',
          streamId: stream.id,
          ipAddress: req.ip || '',
        });
      });

      // Pipe the stream
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
            // Update ping
            await storage.updateConnectionPing(connection.id);
          }
          res.end();
        } catch (err) {
          console.error('Stream error:', err);
          res.end();
        }
      };

      pump();
    } catch (err) {
      console.error('Proxy error:', err);
      await storage.deleteConnection(connection.id);
      return res.status(502).send('Stream unavailable');
    }
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
}
