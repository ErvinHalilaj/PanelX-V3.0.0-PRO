import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerPlayerApi } from "./playerApi";
import bcrypt from "bcryptjs";

// Auth rate limiting cache
const authRateLimitCache = new Map<string, { count: number; firstAttempt: number }>();
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_MAX_FAILED_ATTEMPTS = 10;

function isAuthRateLimited(ip: string): boolean {
  const cached = authRateLimitCache.get(ip);
  if (!cached) return false;
  
  const now = Date.now();
  if (now - cached.firstAttempt > AUTH_RATE_LIMIT_WINDOW_MS) {
    authRateLimitCache.delete(ip);
    return false;
  }
  
  return cached.count >= AUTH_MAX_FAILED_ATTEMPTS;
}

function recordAuthAttempt(ip: string, success: boolean): void {
  if (success) {
    authRateLimitCache.delete(ip);
    return;
  }
  
  const cached = authRateLimitCache.get(ip);
  const now = Date.now();
  
  if (cached) {
    if (now - cached.firstAttempt > AUTH_RATE_LIMIT_WINDOW_MS) {
      authRateLimitCache.set(ip, { count: 1, firstAttempt: now });
    } else {
      cached.count++;
    }
  } else {
    authRateLimitCache.set(ip, { count: 1, firstAttempt: now });
  }
}

// Extend session type to include user
declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "admin" | "reseller";
    username: string;
  }
}

// Auth middleware - requires authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// Reseller auth middleware - requires reseller or admin role
function requireReseller(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.session.role !== "reseller" && req.session.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

// Admin auth middleware - requires admin role
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

async function seedDatabase() {
  // Check if we already have data
  const existingCategories = await storage.getCategories();
  if (existingCategories.length > 0) return;

  console.log("Seeding database with sample data...");

  // Create admin user
  await storage.createUser({
    username: "admin",
    password: "admin123",
    role: "admin",
    credits: 1000,
    notes: "Main administrator account",
  });

  // Create a reseller
  const reseller = await storage.createUser({
    username: "reseller1",
    password: "reseller123",
    role: "reseller",
    credits: 100,
    notes: "Demo reseller account",
  });

  // Create categories
  const sportsCategory = await storage.createCategory({
    categoryName: "Sports",
    categoryType: "live",
  });

  const newsCategory = await storage.createCategory({
    categoryName: "News",
    categoryType: "live",
  });

  const moviesCategory = await storage.createCategory({
    categoryName: "Movies",
    categoryType: "movie",
  });

  const entertainmentCategory = await storage.createCategory({
    categoryName: "Entertainment",
    categoryType: "live",
  });

  // Create sample streams
  const stream1 = await storage.createStream({
    name: "Sports Channel HD",
    streamType: "live",
    sourceUrl: "http://example.com/sports.m3u8",
    categoryId: sportsCategory.id,
    streamIcon: "https://via.placeholder.com/150/FF5733/FFFFFF?text=Sports",
    notes: "24/7 Sports coverage",
    isDirect: false,
    isMonitored: true,
    monitorStatus: "online",
  });

  const stream2 = await storage.createStream({
    name: "World News 24",
    streamType: "live",
    sourceUrl: "http://example.com/news.m3u8",
    categoryId: newsCategory.id,
    streamIcon: "https://via.placeholder.com/150/3498DB/FFFFFF?text=News",
    notes: "International news channel",
    isDirect: false,
    isMonitored: true,
    monitorStatus: "online",
  });

  const stream3 = await storage.createStream({
    name: "Action Movie Channel",
    streamType: "movie",
    sourceUrl: "http://example.com/movies.m3u8",
    categoryId: moviesCategory.id,
    streamIcon: "https://via.placeholder.com/150/9B59B6/FFFFFF?text=Movies",
    isDirect: true,
    isMonitored: true,
    monitorStatus: "online",
  });

  const stream4 = await storage.createStream({
    name: "Entertainment Plus",
    streamType: "live",
    sourceUrl: "http://example.com/entertainment.m3u8",
    categoryId: entertainmentCategory.id,
    streamIcon: "https://via.placeholder.com/150/E74C3C/FFFFFF?text=Ent",
    isDirect: false,
    isMonitored: true,
    monitorStatus: "offline",
  });

  // Create bouquets
  const basicBouquet = await storage.createBouquet({
    bouquetName: "Basic Package",
    bouquetChannels: [stream1.id, stream2.id],
    bouquetMovies: [],
  });

  const premiumBouquet = await storage.createBouquet({
    bouquetName: "Premium Package",
    bouquetChannels: [stream1.id, stream2.id, stream4.id],
    bouquetMovies: [stream3.id],
  });

  // Create sample lines
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1);

  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 5);

  await storage.createLine({
    username: "testuser1",
    password: "test123",
    memberId: reseller.id,
    expDate: futureDate,
    maxConnections: 2,
    isTrial: false,
    bouquets: [premiumBouquet.id],
    enabled: true,
  });

  await storage.createLine({
    username: "testuser2",
    password: "test456",
    memberId: reseller.id,
    expDate: futureDate,
    maxConnections: 1,
    isTrial: true,
    bouquets: [basicBouquet.id],
    enabled: true,
  });

  await storage.createLine({
    username: "expireduser",
    password: "expired123",
    memberId: reseller.id,
    expDate: expiredDate,
    maxConnections: 1,
    isTrial: false,
    bouquets: [basicBouquet.id],
    enabled: true,
  });

  // Create series category
  await storage.createCategory({
    categoryName: "TV Shows",
    categoryType: "series",
  });

  // Seed device templates
  const existingTemplates = await storage.getDeviceTemplates();
  if (existingTemplates.length === 0) {
    await seedDeviceTemplates();
  }

  console.log("Database seeded successfully!");
}

async function seedDeviceTemplates() {
  const templates = [
    {
      deviceKey: 'm3u_plus',
      deviceName: 'M3U Plus (Universal)',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'vlc',
      deviceName: 'VLC Media Player',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1,{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'kodi',
      deviceName: 'Kodi / XBMC',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'tivimate',
      deviceName: 'TiviMate',
      headerTemplate: '#EXTM3U x-tvg-url="{server}/xmltv.php?username={username}&password={password}"',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'smarters',
      deviceName: 'IPTV Smarters Pro',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'perfect_player',
      deviceName: 'Perfect Player',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'gse',
      deviceName: 'GSE Smart IPTV',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'ss_iptv',
      deviceName: 'SS IPTV',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'smart_iptv',
      deviceName: 'Smart IPTV (Samsung/LG)',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'enigma2',
      deviceName: 'Enigma2 / Dreambox',
      headerTemplate: '#NAME PanelX IPTV',
      lineTemplate: '#SERVICE 4097:0:1:0:0:0:0:0:0:0:{server}/live/{username}/{password}/{stream_id}.ts:{stream_name}\n#DESCRIPTION {stream_name}',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'ottplayer',
      deviceName: 'OTT Player',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'firestick',
      deviceName: 'Amazon Fire TV / Firestick',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'android',
      deviceName: 'Android Box / Phone',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'ios',
      deviceName: 'iPhone / iPad',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'roku',
      deviceName: 'Roku',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'apple_tv',
      deviceName: 'Apple TV',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'xtream',
      deviceName: 'Xtream Codes API',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
    {
      deviceKey: 'xciptv',
      deviceName: 'XCIPTV Player',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'duplex',
      deviceName: 'Duplex IPTV',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.m3u8',
      fileExtension: 'm3u8',
    },
    {
      deviceKey: 'stb_emu',
      deviceName: 'STB Emulator',
      headerTemplate: '#EXTM3U',
      lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.ts',
      fileExtension: 'ts',
    },
  ];

  for (const template of templates) {
    await storage.createDeviceTemplate(template);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register Xtream Codes compatible API
  registerPlayerApi(app);

  // Seed database on startup
  seedDatabase().catch(console.error);

  // === AUTHENTICATION ===
  app.post("/api/auth/login", async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Check rate limit first
      if (isAuthRateLimited(ip)) {
        return res.status(429).json({ 
          message: "Too many failed attempts. Please try again later." 
        });
      }
      
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const users = await storage.getUsers();
      const user = users.find(u => u.username === username);
      
      if (!user) {
        recordAuthAttempt(ip, false);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if password is hashed (starts with $2) or plain text (for legacy/seeded users)
      let isValid = false;
      if (user.password.startsWith('$2')) {
        isValid = await bcrypt.compare(password, user.password);
      } else {
        isValid = user.password === password;
      }

      if (!isValid) {
        recordAuthAttempt(ip, false);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Clear rate limit on successful login
      recordAuthAttempt(ip, true);

      // Set session
      req.session.userId = user.id;
      req.session.role = user.role as "admin" | "reseller";
      req.session.username = user.username;

      res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role,
        credits: user.credits
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role,
        credits: user.credits
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // === RESELLER-SCOPED ENDPOINTS ===
  // These endpoints filter data by the authenticated reseller's ID
  
  app.get("/api/reseller/lines", requireReseller, async (req, res) => {
    try {
      const allLines = await storage.getLines();
      // Filter lines belonging to this reseller (memberId = userId)
      // Only return lines where memberId matches and is not null
      const resellerLines = allLines.filter(line => 
        line.memberId !== null && line.memberId === req.session.userId
      );
      res.json(resellerLines);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch lines" });
    }
  });

  app.post("/api/reseller/lines", requireReseller, async (req, res) => {
    try {
      const input = api.lines.create.input.parse({
        ...req.body,
        memberId: req.session.userId // Force memberId to current reseller
      });
      const line = await storage.createLine(input);
      res.status(201).json(line);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create line" });
    }
  });

  app.delete("/api/reseller/lines/:id", requireReseller, async (req, res) => {
    try {
      const line = await storage.getLine(Number(req.params.id));
      if (!line) {
        return res.status(404).json({ message: "Line not found" });
      }
      // Reject lines without ownership or belonging to different reseller
      if (line.memberId === null || line.memberId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteLine(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete line" });
    }
  });

  app.get("/api/reseller/tickets", requireReseller, async (req, res) => {
    try {
      const allTickets = await storage.getTickets();
      // Filter tickets belonging to this reseller
      // Only return tickets where userId matches and is not null
      const resellerTickets = allTickets.filter(ticket => 
        ticket.userId !== null && ticket.userId === req.session.userId
      );
      res.json(resellerTickets);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/reseller/tickets", requireReseller, async (req, res) => {
    try {
      const { subject, message, priority, category } = req.body;
      const ticket = await storage.createTicket({
        userId: req.session.userId!,
        subject,
        message,
        priority: priority || "medium",
        category: category || "general",
        status: "open"
      });
      res.status(201).json(ticket);
    } catch (err) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.post("/api/reseller/tickets/:id/reply", requireReseller, async (req, res) => {
    try {
      const ticket = await storage.getTicket(Number(req.params.id));
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      // Reject tickets without ownership or belonging to different reseller
      if (ticket.userId === null || ticket.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const reply = await storage.createTicketReply({
        ticketId: Number(req.params.id),
        userId: req.session.userId!,
        message: req.body.message,
        isAdmin: false
      });
      res.status(201).json(reply);
    } catch (err) {
      res.status(500).json({ message: "Failed to add reply" });
    }
  });

  // === STATS ===
  app.get(api.stats.get.path, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // === USERS ===
  app.get(api.users.list.path, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.users.update.path, async (req, res) => {
    try {
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.users.delete.path, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.users.addCredits.path, async (req, res) => {
    try {
      const { amount, reason } = api.users.addCredits.input.parse(req.body);
      const user = await storage.addCredits(Number(req.params.id), amount, reason || 'admin_add');
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === CATEGORIES ===
  app.get(api.categories.list.path, async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.post(api.categories.create.path, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const category = await storage.createCategory(input);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.categories.update.path, async (req, res) => {
    try {
      const input = api.categories.update.input.parse(req.body);
      const category = await storage.updateCategory(Number(req.params.id), input);
      res.json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.categories.delete.path, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  // === STREAMS ===
  app.get(api.streams.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const type = req.query.type as string | undefined;
    const streams = await storage.getStreams(categoryId, type);
    res.json(streams);
  });

  app.get(api.streams.get.path, async (req, res) => {
    const stream = await storage.getStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Stream not found" });
    res.json(stream);
  });

  app.post(api.streams.create.path, async (req, res) => {
    try {
      const input = api.streams.create.input.parse(req.body);
      const stream = await storage.createStream(input);
      res.status(201).json(stream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.streams.update.path, async (req, res) => {
    try {
      const input = api.streams.update.input.parse(req.body);
      const stream = await storage.updateStream(Number(req.params.id), input);
      res.json(stream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.streams.delete.path, async (req, res) => {
    await storage.deleteStream(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.streams.checkStatus.path, async (req, res) => {
    const stream = await storage.getStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    // Simple status check - try to fetch headers
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(stream.sourceUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const status = response.ok ? 'online' : 'offline';
      await storage.updateStream(stream.id, { monitorStatus: status, lastChecked: new Date() } as any);
      res.json({ status });
    } catch (err) {
      await storage.updateStream(stream.id, { monitorStatus: 'offline', lastChecked: new Date() } as any);
      res.json({ status: 'offline' });
    }
  });

  // === BOUQUETS ===
  app.get(api.bouquets.list.path, async (_req, res) => {
    const bouquets = await storage.getBouquets();
    res.json(bouquets);
  });

  app.get(api.bouquets.get.path, async (req, res) => {
    const bouquet = await storage.getBouquet(Number(req.params.id));
    if (!bouquet) return res.status(404).json({ message: "Bouquet not found" });
    res.json(bouquet);
  });

  app.post(api.bouquets.create.path, async (req, res) => {
    try {
      const input = api.bouquets.create.input.parse(req.body);
      const bouquet = await storage.createBouquet(input);
      res.status(201).json(bouquet);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.bouquets.update.path, async (req, res) => {
    try {
      const input = api.bouquets.update.input.parse(req.body);
      const bouquet = await storage.updateBouquet(Number(req.params.id), input);
      res.json(bouquet);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.bouquets.delete.path, async (req, res) => {
    await storage.deleteBouquet(Number(req.params.id));
    res.status(204).send();
  });

  // === LINES ===
  app.get(api.lines.list.path, async (_req, res) => {
    const lines = await storage.getLines();
    res.json(lines);
  });

  app.get(api.lines.get.path, async (req, res) => {
    const line = await storage.getLine(Number(req.params.id));
    if (!line) return res.status(404).json({ message: "Line not found" });
    res.json(line);
  });

  app.post(api.lines.create.path, async (req, res) => {
    try {
      const { useCredits, creditCost, ...lineData } = req.body;
      const input = api.lines.create.input.omit({ useCredits: true, creditCost: true }).parse(lineData);
      
      // If using credits, deduct from reseller
      if (useCredits && input.memberId && creditCost) {
        const user = await storage.getUser(input.memberId);
        if (!user || (user.credits || 0) < creditCost) {
          return res.status(400).json({ message: "Insufficient credits" });
        }
        await storage.addCredits(input.memberId, -creditCost, 'line_create');
      }
      
      const line = await storage.createLine(input);
      res.status(201).json(line);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.lines.update.path, async (req, res) => {
    try {
      const input = api.lines.update.input.parse(req.body);
      const line = await storage.updateLine(Number(req.params.id), input);
      res.json(line);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.lines.delete.path, async (req, res) => {
    await storage.deleteLine(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.lines.extend.path, async (req, res) => {
    try {
      const { days, useCredits } = api.lines.extend.input.parse(req.body);
      const lineId = Number(req.params.id);
      
      const existingLine = await storage.getLine(lineId);
      if (!existingLine) {
        return res.status(404).json({ message: "Line not found" });
      }

      if (useCredits && existingLine.memberId) {
        const creditCost = days; // 1 credit per day
        const user = await storage.getUser(existingLine.memberId);
        if (!user || (user.credits || 0) < creditCost) {
          return res.status(400).json({ message: "Insufficient credits" });
        }
        await storage.addCredits(existingLine.memberId, -creditCost, 'line_extend', lineId);
      }

      const line = await storage.extendLine(lineId, days);
      res.json(line);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === CONNECTIONS ===
  app.get(api.connections.list.path, async (_req, res) => {
    // Clean up stale connections first
    await storage.cleanupStaleConnections();
    const connections = await storage.getActiveConnections();
    res.json(connections);
  });

  app.delete(api.connections.kill.path, async (req, res) => {
    await storage.deleteConnection(Number(req.params.id));
    res.status(204).send();
  });

  // === ACTIVITY ===
  app.get(api.activity.list.path, async (req, res) => {
    const lineId = req.query.lineId ? Number(req.query.lineId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const activity = await storage.getActivityLog(lineId, limit);
    res.json(activity);
  });

  // === CREDITS ===
  app.get(api.credits.list.path, async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const transactions = await storage.getCreditTransactions(userId);
    res.json(transactions);
  });

  // === SERVERS ===
  app.get(api.servers.list.path, async (_req, res) => {
    const servers = await storage.getServers();
    res.json(servers);
  });

  app.get(api.servers.get.path, async (req, res) => {
    const server = await storage.getServer(Number(req.params.id));
    if (!server) return res.status(404).json({ message: "Server not found" });
    res.json(server);
  });

  app.post(api.servers.create.path, async (req, res) => {
    try {
      const input = api.servers.create.input.parse(req.body);
      const server = await storage.createServer(input);
      res.status(201).json(server);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.servers.update.path, async (req, res) => {
    try {
      const input = api.servers.update.input.parse(req.body);
      const server = await storage.updateServer(Number(req.params.id), input);
      res.json(server);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.servers.delete.path, async (req, res) => {
    await storage.deleteServer(Number(req.params.id));
    res.status(204).send();
  });

  // === EPG SOURCES ===
  app.get(api.epgSources.list.path, async (_req, res) => {
    const sources = await storage.getEpgSources();
    res.json(sources);
  });

  app.get(api.epgSources.get.path, async (req, res) => {
    const source = await storage.getEpgSource(Number(req.params.id));
    if (!source) return res.status(404).json({ message: "EPG source not found" });
    res.json(source);
  });

  app.post(api.epgSources.create.path, async (req, res) => {
    try {
      const input = api.epgSources.create.input.parse(req.body);
      const source = await storage.createEpgSource(input);
      res.status(201).json(source);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.epgSources.update.path, async (req, res) => {
    try {
      const input = api.epgSources.update.input.parse(req.body);
      const source = await storage.updateEpgSource(Number(req.params.id), input);
      res.json(source);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.epgSources.delete.path, async (req, res) => {
    await storage.deleteEpgSource(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.epgSources.refresh.path, async (req, res) => {
    const source = await storage.getEpgSource(Number(req.params.id));
    if (!source) return res.status(404).json({ message: "EPG source not found" });
    // EPG refresh logic would go here - for now just acknowledge
    res.json({ message: "EPG refresh initiated", count: 0 });
  });

  // === SERIES ===
  app.get(api.series.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const seriesList = await storage.getSeries(categoryId);
    res.json(seriesList);
  });

  app.get(api.series.get.path, async (req, res) => {
    const s = await storage.getSeriesById(Number(req.params.id));
    if (!s) return res.status(404).json({ message: "Series not found" });
    res.json(s);
  });

  app.post(api.series.create.path, async (req, res) => {
    try {
      const input = api.series.create.input.parse(req.body);
      const s = await storage.createSeries(input);
      res.status(201).json(s);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.series.update.path, async (req, res) => {
    try {
      const input = api.series.update.input.parse(req.body);
      const s = await storage.updateSeries(Number(req.params.id), input);
      res.json(s);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.series.delete.path, async (req, res) => {
    await storage.deleteSeries(Number(req.params.id));
    res.status(204).send();
  });

  // === EPISODES ===
  app.get(api.episodes.list.path, async (req, res) => {
    const seriesId = Number(req.params.seriesId);
    const seasonNum = req.query.seasonNum ? Number(req.query.seasonNum) : undefined;
    const episodeList = await storage.getEpisodes(seriesId, seasonNum);
    res.json(episodeList);
  });

  app.get(api.episodes.get.path, async (req, res) => {
    const episode = await storage.getEpisode(Number(req.params.id));
    if (!episode) return res.status(404).json({ message: "Episode not found" });
    res.json(episode);
  });

  app.post(api.episodes.create.path, async (req, res) => {
    try {
      const input = api.episodes.create.input.parse({
        ...req.body,
        seriesId: Number(req.params.seriesId),
      });
      const episode = await storage.createEpisode(input);
      res.status(201).json(episode);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.episodes.update.path, async (req, res) => {
    try {
      const input = api.episodes.update.input.parse(req.body);
      const episode = await storage.updateEpisode(Number(req.params.id), input);
      res.json(episode);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.episodes.delete.path, async (req, res) => {
    await storage.deleteEpisode(Number(req.params.id));
    res.status(204).send();
  });

  // === VOD INFO ===
  app.get(api.vodInfo.get.path, async (req, res) => {
    const info = await storage.getVodInfo(Number(req.params.streamId));
    if (!info) return res.status(404).json({ message: "VOD info not found" });
    res.json(info);
  });

  app.put(api.vodInfo.createOrUpdate.path, async (req, res) => {
    try {
      const streamId = Number(req.params.streamId);
      const existing = await storage.getVodInfo(streamId);
      
      if (existing) {
        const updated = await storage.updateVodInfo(existing.id, req.body);
        res.json(updated);
      } else {
        const created = await storage.createVodInfo({ ...req.body, streamId });
        res.json(created);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === BLOCKED IPS ===
  app.get(api.blockedIps.list.path, async (_req, res) => {
    const blocked = await storage.getBlockedIps();
    res.json(blocked);
  });

  app.post(api.blockedIps.create.path, async (req, res) => {
    try {
      const input = api.blockedIps.create.input.parse(req.body);
      const blocked = await storage.blockIp(input);
      res.status(201).json(blocked);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.blockedIps.delete.path, async (req, res) => {
    await storage.unblockIp(Number(req.params.id));
    res.status(204).send();
  });

  // === BLOCKED USER AGENTS ===
  app.get(api.blockedUserAgents.list.path, async (_req, res) => {
    const blocked = await storage.getBlockedUserAgents();
    res.json(blocked);
  });

  app.post(api.blockedUserAgents.create.path, async (req, res) => {
    try {
      const input = api.blockedUserAgents.create.input.parse(req.body);
      const blocked = await storage.blockUserAgent(input);
      res.status(201).json(blocked);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.blockedUserAgents.delete.path, async (req, res) => {
    await storage.unblockUserAgent(Number(req.params.id));
    res.status(204).send();
  });

  // === DEVICE TEMPLATES ===
  app.get(api.deviceTemplates.list.path, async (_req, res) => {
    const templates = await storage.getDeviceTemplates();
    res.json(templates);
  });

  app.get(api.deviceTemplates.get.path, async (req, res) => {
    const template = await storage.getDeviceTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: "Device template not found" });
    res.json(template);
  });

  app.post(api.deviceTemplates.create.path, async (req, res) => {
    try {
      const input = api.deviceTemplates.create.input.parse(req.body);
      const template = await storage.createDeviceTemplate(input);
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.deviceTemplates.update.path, async (req, res) => {
    try {
      const input = api.deviceTemplates.update.input.parse(req.body);
      const template = await storage.updateDeviceTemplate(Number(req.params.id), input);
      res.json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.deviceTemplates.delete.path, async (req, res) => {
    await storage.deleteDeviceTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // === TRANSCODE PROFILES ===
  app.get(api.transcodeProfiles.list.path, async (_req, res) => {
    const profiles = await storage.getTranscodeProfiles();
    res.json(profiles);
  });

  app.get(api.transcodeProfiles.get.path, async (req, res) => {
    const profile = await storage.getTranscodeProfile(Number(req.params.id));
    if (!profile) return res.status(404).json({ message: "Transcode profile not found" });
    res.json(profile);
  });

  app.post(api.transcodeProfiles.create.path, async (req, res) => {
    try {
      const input = api.transcodeProfiles.create.input.parse(req.body);
      const profile = await storage.createTranscodeProfile(input);
      res.status(201).json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.transcodeProfiles.update.path, async (req, res) => {
    try {
      const input = api.transcodeProfiles.update.input.parse(req.body);
      const profile = await storage.updateTranscodeProfile(Number(req.params.id), input);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.transcodeProfiles.delete.path, async (req, res) => {
    await storage.deleteTranscodeProfile(Number(req.params.id));
    res.status(204).send();
  });

  // === RESELLER GROUPS ===
  app.get(api.resellerGroups.list.path, async (_req, res) => {
    const groups = await storage.getResellerGroups();
    res.json(groups);
  });

  app.get(api.resellerGroups.get.path, async (req, res) => {
    const group = await storage.getResellerGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ message: "Reseller group not found" });
    res.json(group);
  });

  app.post(api.resellerGroups.create.path, async (req, res) => {
    try {
      const input = api.resellerGroups.create.input.parse(req.body);
      const group = await storage.createResellerGroup(input);
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.resellerGroups.update.path, async (req, res) => {
    try {
      const input = api.resellerGroups.update.input.parse(req.body);
      const group = await storage.updateResellerGroup(Number(req.params.id), input);
      res.json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.resellerGroups.delete.path, async (req, res) => {
    await storage.deleteResellerGroup(Number(req.params.id));
    res.status(204).send();
  });

  // === PACKAGES ===
  app.get(api.packages.list.path, async (_req, res) => {
    const pkgs = await storage.getPackages();
    res.json(pkgs);
  });

  app.get(api.packages.get.path, async (req, res) => {
    const pkg = await storage.getPackage(Number(req.params.id));
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  });

  app.post(api.packages.create.path, async (req, res) => {
    try {
      const input = api.packages.create.input.parse(req.body);
      const pkg = await storage.createPackage(input);
      res.status(201).json(pkg);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.packages.update.path, async (req, res) => {
    try {
      const input = api.packages.update.input.parse(req.body);
      const pkg = await storage.updatePackage(Number(req.params.id), input);
      res.json(pkg);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.packages.delete.path, async (req, res) => {
    await storage.deletePackage(Number(req.params.id));
    res.status(204).send();
  });

  // === TICKETS ===
  app.get("/api/tickets", async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const status = req.query.status as string | undefined;
    const tickets = await storage.getTickets(userId, status);
    res.json(tickets);
  });

  app.get("/api/tickets/:id", async (req, res) => {
    const ticket = await storage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const ticket = await storage.createTicket(req.body);
      res.status(201).json(ticket);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.updateTicket(Number(req.params.id), req.body);
      res.json(ticket);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/tickets/:id", async (req, res) => {
    await storage.deleteTicket(Number(req.params.id));
    res.status(204).send();
  });

  // Ticket Replies
  app.get("/api/tickets/:id/replies", async (req, res) => {
    const replies = await storage.getTicketReplies(Number(req.params.id));
    res.json(replies);
  });

  app.post("/api/tickets/:id/replies", async (req, res) => {
    try {
      const reply = await storage.createTicketReply({
        ...req.body,
        ticketId: Number(req.params.id)
      });
      res.status(201).json(reply);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === BULK OPERATIONS ===
  app.post(api.bulk.deleteStreams.path, async (req, res) => {
    try {
      const { ids } = api.bulk.deleteStreams.input.parse(req.body);
      await storage.bulkDeleteStreams(ids);
      res.json({ deleted: ids.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.bulk.deleteLines.path, async (req, res) => {
    try {
      const { ids } = api.bulk.deleteLines.input.parse(req.body);
      await storage.bulkDeleteLines(ids);
      res.json({ deleted: ids.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === M3U IMPORT ===
  app.post(api.bulk.importM3U.path, async (req, res) => {
    try {
      const { content, categoryId, streamType } = api.bulk.importM3U.input.parse(req.body);
      
      // Parse M3U content
      const lines = content.split('\n');
      const streamList: Array<{
        name: string;
        sourceUrl: string;
        streamIcon?: string;
        epgChannelId?: string;
      }> = [];
      
      let currentName = '';
      let currentIcon = '';
      let currentEpgId = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('#EXTINF:')) {
          // Parse EXTINF line
          const nameMatch = line.match(/,(.+)$/);
          currentName = nameMatch ? nameMatch[1].trim() : `Stream ${streamList.length + 1}`;
          
          const logoMatch = line.match(/tvg-logo="([^"]+)"/);
          currentIcon = logoMatch ? logoMatch[1] : '';
          
          const epgMatch = line.match(/tvg-id="([^"]+)"/);
          currentEpgId = epgMatch ? epgMatch[1] : '';
        } else if (line && !line.startsWith('#') && (line.startsWith('http') || line.startsWith('rtmp'))) {
          // This is a URL line
          if (currentName) {
            streamList.push({
              name: currentName,
              sourceUrl: line,
              streamIcon: currentIcon || undefined,
              epgChannelId: currentEpgId || undefined,
            });
          }
          currentName = '';
          currentIcon = '';
          currentEpgId = '';
        }
      }
      
      // Create streams
      const createdStreams = await storage.bulkCreateStreams(
        streamList.map(s => ({
          name: s.name,
          sourceUrl: s.sourceUrl,
          streamType,
          categoryId: categoryId || null,
          streamIcon: s.streamIcon || null,
          epgChannelId: s.epgChannelId || null,
          isDirect: false,
          isMonitored: true,
          monitorStatus: 'unknown',
        }))
      );
      
      res.json({ imported: createdStreams.length, streams: createdStreams });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === XTREAM API IMPORT ===
  // Security note: This endpoint has basic SSRF protection (hostname validation, redirect blocking, timeouts)
  // but full DNS rebinding protection would require resolving hostnames to IPs before requests.
  // This endpoint should only be accessible to trusted admin users.
  app.post("/api/streams/import-xtream", async (req, res) => {
    try {
      const schema = z.object({
        url: z.string().url().refine((u) => {
          try {
            const parsed = new URL(u);
            // Block internal/private IPs
            const hostname = parsed.hostname.toLowerCase();
            if (hostname === 'localhost' || 
                hostname === '127.0.0.1' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.') ||
                hostname.endsWith('.local') ||
                hostname === '0.0.0.0' ||
                hostname.includes('169.254.')) {
              return false;
            }
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        }, { message: "Invalid URL or internal network address not allowed" }),
        username: z.string().min(1),
        password: z.string().min(1),
        categoryId: z.number().optional(),
        streamType: z.enum(["live", "movie"]).default("live"),
      });

      const { url, username, password, categoryId, streamType } = schema.parse(req.body);

      // Normalize the URL
      const baseUrl = url.replace(/\/$/, "");
      
      // Fetch streams from Xtream API
      const action = streamType === "live" ? "get_live_streams" : "get_vod_streams";
      const apiUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;
      
      let response;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        response = await fetch(apiUrl, { 
          signal: controller.signal,
          redirect: "manual", // Block redirects to prevent SSRF via redirect chains
        });
        clearTimeout(timeoutId);
        
        // If we got a redirect, reject it
        if (response.status >= 300 && response.status < 400) {
          throw new Error("Redirects are not allowed for security reasons");
        }
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          throw new Error("Connection timed out - panel may be unreachable");
        }
        throw new Error(`Network error: ${fetchErr.message || "Failed to connect"}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to connect to Xtream panel: ${response.status} ${response.statusText}`);
      }
      
      let streams;
      try {
        streams = await response.json() as Array<{
          stream_id: number;
          name: string;
          stream_icon?: string;
          epg_channel_id?: string;
          category_id?: string;
          container_extension?: string;
        }>;
      } catch {
        throw new Error("Invalid JSON response from Xtream panel");
      }

      if (!Array.isArray(streams)) {
        throw new Error("Invalid response format from Xtream panel - expected array");
      }
      
      if (streams.length === 0) {
        return res.json({ imported: 0, streams: [], message: "No streams found in panel" });
      }

      // Build stream source URLs
      const streamList = streams.map(s => {
        const ext = s.container_extension || (streamType === "live" ? "ts" : "mp4");
        const streamPath = streamType === "live" 
          ? `${baseUrl}/live/${username}/${password}/${s.stream_id}.${ext}`
          : `${baseUrl}/movie/${username}/${password}/${s.stream_id}.${ext}`;
        
        return {
          name: s.name || `Stream ${s.stream_id}`,
          sourceUrl: streamPath,
          streamType,
          categoryId: categoryId || null,
          streamIcon: s.stream_icon || null,
          epgChannelId: s.epg_channel_id || null,
          isDirect: false,
          isMonitored: true,
          monitorStatus: 'unknown' as const,
        };
      });

      // Create streams in bulk
      const createdStreams = await storage.bulkCreateStreams(streamList);
      
      res.json({ imported: createdStreams.length, streams: createdStreams });
    } catch (err: any) {
      console.error("Xtream import error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message || "Failed to import from Xtream" });
    }
  });

  return httpServer;
}
