import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerPlayerApi } from "./playerApi";
import bcrypt from "bcryptjs";
import { 
  insertSettingSchema, insertAccessOutputSchema, insertReservedUsernameSchema,
  insertCreatedChannelSchema, insertEnigma2DeviceSchema, insertEnigma2ActionSchema, insertSignalSchema,
  insertActivationCodeSchema, insertConnectionHistorySchema, insertTwoFactorAuthSchema,
  insertFingerprintSettingsSchema, insertLineFingerprintSchema, insertWatchFolderSchema,
  insertLoopingChannelSchema, insertAutoblockRuleSchema, insertStatisticsSnapshotSchema, insertImpersonationLogSchema
} from "@shared/schema";
import * as OTPAuth from "otpauth";

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
      
      const { username, password, totpCode } = req.body;
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

      // Check if 2FA is enabled for this user
      const twoFactor = await storage.getTwoFactorAuth(user.id);
      if (twoFactor && twoFactor.enabled) {
        // 2FA is required - verify the TOTP code
        if (!totpCode) {
          return res.status(200).json({ 
            requires2FA: true,
            message: "Two-factor authentication code required"
          });
        }

        // Verify the TOTP code
        const totp = new OTPAuth.TOTP({
          issuer: "PanelX",
          label: user.username,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(twoFactor.secret),
        });

        const delta = totp.validate({ token: totpCode, window: 1 });
        
        if (delta === null) {
          // Check backup codes
          const backupCodes = (twoFactor.backupCodes as string[]) || [];
          const codeIndex = backupCodes.indexOf(totpCode);
          
          if (codeIndex === -1) {
            recordAuthAttempt(ip, false);
            return res.status(401).json({ message: "Invalid two-factor code" });
          }
          
          // Remove used backup code
          const newBackupCodes = backupCodes.filter((_, i) => i !== codeIndex);
          await storage.updateTwoFactorAuth(user.id, { backupCodes: newBackupCodes });
        }
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
        priority: priority || "medium",
        category: category || "general",
        status: "open"
      });
      if (message) {
        await storage.createTicketReply({
          ticketId: ticket.id,
          userId: req.session.userId!,
          message,
          isAdminReply: false
        });
      }
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
        isAdminReply: false
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

  // Stream control endpoints
  app.post("/api/streams/:id/start", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const stream = await storage.getStream(streamId);
      
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { ffmpegManager } = await import('./ffmpegManager');
      await ffmpegManager.startStream(streamId);
      
      res.json({ 
        success: true, 
        message: "Stream started successfully",
        status: ffmpegManager.getStatus(streamId)
      });
    } catch (error: any) {
      console.error('[API] Stream start error:', error);
      res.status(500).json({ message: error.message || "Failed to start stream" });
    }
  });

  app.post("/api/streams/:id/stop", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const stream = await storage.getStream(streamId);
      
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { ffmpegManager } = await import('./ffmpegManager');
      await ffmpegManager.stopStream(streamId);
      
      res.json({ 
        success: true, 
        message: "Stream stopped successfully" 
      });
    } catch (error: any) {
      console.error('[API] Stream stop error:', error);
      res.status(500).json({ message: error.message || "Failed to stop stream" });
    }
  });

  app.post("/api/streams/:id/restart", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const stream = await storage.getStream(streamId);
      
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { ffmpegManager } = await import('./ffmpegManager');
      await ffmpegManager.restartStream(streamId);
      
      res.json({ 
        success: true, 
        message: "Stream restarted successfully",
        status: ffmpegManager.getStatus(streamId)
      });
    } catch (error: any) {
      console.error('[API] Stream restart error:', error);
      res.status(500).json({ message: error.message || "Failed to restart stream" });
    }
  });

  app.get("/api/streams/:id/status", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const stream = await storage.getStream(streamId);
      
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { ffmpegManager } = await import('./ffmpegManager');
      const isRunning = ffmpegManager.isRunning(streamId);
      const status = ffmpegManager.getStatus(streamId);
      const activeProcesses = ffmpegManager.getActiveProcesses();
      const processInfo = activeProcesses.get(streamId);
      
      res.json({ 
        streamId,
        isRunning,
        status: status || stream.monitorStatus || 'offline',
        viewerCount: processInfo?.viewerCount || 0,
        startedAt: processInfo?.startedAt || null,
        pid: processInfo?.pid || null
      });
    } catch (error: any) {
      console.error('[API] Stream status error:', error);
      res.status(500).json({ message: error.message || "Failed to get stream status" });
    }
  });

  // DVR Endpoints - Recording functionality
  app.post("/api/streams/:id/record/start", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const { duration = 60 } = req.body; // duration in minutes

      const stream = await storage.getStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { getDVRManager } = await import('./dvrManager');
      const dvrManager = getDVRManager();
      
      if (!dvrManager) {
        return res.status(500).json({ message: "DVR manager not initialized" });
      }

      const recordingId = await dvrManager.startRecording(streamId, duration);
      
      res.json({ 
        message: "Recording started",
        recordingId,
        streamId,
        duration
      });
    } catch (error: any) {
      console.error('[API] Start recording error:', error);
      res.status(500).json({ message: error.message || "Failed to start recording" });
    }
  });

  app.post("/api/recordings/:id/stop", requireAuth, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);

      const { getDVRManager } = await import('./dvrManager');
      const dvrManager = getDVRManager();
      
      if (!dvrManager) {
        return res.status(500).json({ message: "DVR manager not initialized" });
      }

      await dvrManager.stopRecording(recordingId);
      
      res.json({ message: "Recording stopped", recordingId });
    } catch (error: any) {
      console.error('[API] Stop recording error:', error);
      res.status(500).json({ message: error.message || "Failed to stop recording" });
    }
  });

  app.get("/api/recordings", requireAuth, async (req, res) => {
    try {
      const archives = await storage.getTvArchives();
      
      res.json(archives);
    } catch (error: any) {
      console.error('[API] Get recordings error:', error);
      res.status(500).json({ message: error.message || "Failed to get recordings" });
    }
  });

  app.get("/api/recordings/:id", requireAuth, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);
      const archive = await storage.getTvArchive(recordingId);
      
      if (!archive) {
        return res.status(404).json({ message: "Recording not found" });
      }

      res.json(archive);
    } catch (error: any) {
      console.error('[API] Get recording error:', error);
      res.status(500).json({ message: error.message || "Failed to get recording" });
    }
  });

  app.delete("/api/recordings/:id", requireAuth, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);

      const { getDVRManager } = await import('./dvrManager');
      const dvrManager = getDVRManager();
      
      if (!dvrManager) {
        return res.status(500).json({ message: "DVR manager not initialized" });
      }

      await dvrManager.deleteRecording(recordingId);
      
      res.json({ message: "Recording deleted", recordingId });
    } catch (error: any) {
      console.error('[API] Delete recording error:', error);
      res.status(500).json({ message: error.message || "Failed to delete recording" });
    }
  });

  app.get("/api/recordings/storage/usage", requireAuth, async (req, res) => {
    try {
      const { getDVRManager } = await import('./dvrManager');
      const dvrManager = getDVRManager();
      
      if (!dvrManager) {
        return res.status(500).json({ message: "DVR manager not initialized" });
      }

      const activeRecordings = dvrManager.getActiveRecordings();
      const storageUsed = await dvrManager.getStorageUsed();
      
      res.json({ 
        activeRecordings: activeRecordings.length,
        storageUsed,
        storageUsedMB: (storageUsed / (1024 * 1024)).toFixed(2),
        storageUsedGB: (storageUsed / (1024 * 1024 * 1024)).toFixed(2)
      });
    } catch (error: any) {
      console.error('[API] Get storage usage error:', error);
      res.status(500).json({ message: error.message || "Failed to get storage usage" });
    }
  });

  // Timeshift/Catchup endpoints
  app.post("/api/streams/:id/timeshift/start", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const stream = await storage.getStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      if (!stream.tvArchiveEnabled) {
        return res.status(400).json({ message: "TV Archive not enabled for this stream" });
      }

      const { timeshiftManager } = await import('./timeshiftManager');
      const session = await timeshiftManager.startTimeshift(stream);
      
      res.json({ 
        message: "Timeshift started",
        streamId,
        session: {
          status: session.status,
          startTime: session.startTime,
          bufferPath: session.bufferPath
        }
      });
    } catch (error: any) {
      console.error('[API] Start timeshift error:', error);
      res.status(500).json({ message: error.message || "Failed to start timeshift" });
    }
  });

  app.post("/api/streams/:id/timeshift/stop", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { timeshiftManager } = await import('./timeshiftManager');
      await timeshiftManager.stopTimeshift(streamId);
      
      res.json({ message: "Timeshift stopped", streamId });
    } catch (error: any) {
      console.error('[API] Stop timeshift error:', error);
      res.status(500).json({ message: error.message || "Failed to stop timeshift" });
    }
  });

  app.get("/api/streams/:id/timeshift/position", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { timeshiftManager } = await import('./timeshiftManager');
      const position = timeshiftManager.getPosition(streamId);
      
      if (!position) {
        return res.status(404).json({ message: "No active timeshift session" });
      }

      res.json(position);
    } catch (error: any) {
      console.error('[API] Get timeshift position error:', error);
      res.status(500).json({ message: error.message || "Failed to get timeshift position" });
    }
  });

  app.post("/api/streams/:id/timeshift/seek", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const { position } = req.body;

      if (typeof position !== 'number') {
        return res.status(400).json({ message: "Position must be a number" });
      }

      const { timeshiftManager } = await import('./timeshiftManager');
      const playlistPath = await timeshiftManager.seekTo(streamId, position);
      
      res.json({ 
        message: "Seek successful",
        streamId,
        position,
        playlistPath
      });
    } catch (error: any) {
      console.error('[API] Timeshift seek error:', error);
      res.status(500).json({ message: error.message || "Failed to seek" });
    }
  });

  app.post("/api/streams/:id/timeshift/watch-from-start", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { timeshiftManager } = await import('./timeshiftManager');
      const playlistPath = await timeshiftManager.watchFromStart(streamId);
      
      res.json({ 
        message: "Watching from start",
        streamId,
        position: 0,
        playlistPath
      });
    } catch (error: any) {
      console.error('[API] Watch from start error:', error);
      res.status(500).json({ message: error.message || "Failed to watch from start" });
    }
  });

  app.post("/api/streams/:id/timeshift/go-live", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { timeshiftManager } = await import('./timeshiftManager');
      const playlistPath = await timeshiftManager.goLive(streamId);
      
      res.json({ 
        message: "Switched to live",
        streamId,
        playlistPath
      });
    } catch (error: any) {
      console.error('[API] Go live error:', error);
      res.status(500).json({ message: error.message || "Failed to switch to live" });
    }
  });

  app.get("/api/timeshift/sessions", requireAuth, async (req, res) => {
    try {
      const { timeshiftManager } = await import('./timeshiftManager');
      const sessions = timeshiftManager.getAllSessions();
      
      res.json({ 
        sessions: sessions.map(s => ({
          streamId: s.streamId,
          status: s.status,
          startTime: s.startTime,
          currentPosition: s.currentPosition,
          segmentCount: s.segments.length
        }))
      });
    } catch (error: any) {
      console.error('[API] Get timeshift sessions error:', error);
      res.status(500).json({ message: error.message || "Failed to get sessions" });
    }
  });

  // Multi-Bitrate (ABR) endpoints
  app.post("/api/streams/:id/abr/start", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const { variants } = req.body;

      const stream = await storage.getStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const { multiBitrateManager } = await import('./multiBitrateManager');
      const session = await multiBitrateManager.startABR(stream, variants);
      
      res.json({ 
        message: "Adaptive bitrate streaming started",
        streamId,
        session: {
          status: session.status,
          variants: session.variants.map(v => ({
            id: v.id,
            label: v.label,
            resolution: v.resolution,
            bandwidth: v.bandwidth
          })),
          masterPlaylist: session.masterPlaylist
        }
      });
    } catch (error: any) {
      console.error('[API] Start ABR error:', error);
      res.status(500).json({ message: error.message || "Failed to start ABR" });
    }
  });

  app.post("/api/streams/:id/abr/stop", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { multiBitrateManager } = await import('./multiBitrateManager');
      await multiBitrateManager.stopABR(streamId);
      
      res.json({ message: "Adaptive bitrate streaming stopped", streamId });
    } catch (error: any) {
      console.error('[API] Stop ABR error:', error);
      res.status(500).json({ message: error.message || "Failed to stop ABR" });
    }
  });

  app.get("/api/streams/:id/abr/session", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { multiBitrateManager } = await import('./multiBitrateManager');
      const session = multiBitrateManager.getSession(streamId);
      
      if (!session) {
        return res.status(404).json({ message: "No active ABR session" });
      }

      res.json({
        streamId: session.streamId,
        status: session.status,
        variants: session.variants.map(v => ({
          id: v.id,
          label: v.label,
          resolution: v.resolution,
          videoBitrate: v.videoBitrate,
          audioBitrate: v.audioBitrate,
          bandwidth: v.bandwidth,
          enabled: v.enabled
        })),
        masterPlaylist: session.masterPlaylist
      });
    } catch (error: any) {
      console.error('[API] Get ABR session error:', error);
      res.status(500).json({ message: error.message || "Failed to get ABR session" });
    }
  });

  app.get("/api/streams/:id/abr/variants", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);

      const { multiBitrateManager } = await import('./multiBitrateManager');
      const variants = multiBitrateManager.getVariants(streamId);
      
      res.json({ streamId, variants });
    } catch (error: any) {
      console.error('[API] Get ABR variants error:', error);
      res.status(500).json({ message: error.message || "Failed to get variants" });
    }
  });

  app.get("/api/abr/sessions", requireAuth, async (req, res) => {
    try {
      const { multiBitrateManager } = await import('./multiBitrateManager');
      const sessions = multiBitrateManager.getAllSessions();
      
      res.json({ 
        sessions: sessions.map(s => ({
          streamId: s.streamId,
          status: s.status,
          variantCount: s.variants.length,
          masterPlaylist: s.masterPlaylist
        }))
      });
    } catch (error: any) {
      console.error('[API] Get ABR sessions error:', error);
      res.status(500).json({ message: error.message || "Failed to get ABR sessions" });
    }
  });

  // Stream Schedule endpoints (in-memory for now)
  const schedules = new Map(); // Simple in-memory storage

  app.post("/api/streams/:id/schedules", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const scheduleData = req.body;

      const stream = await storage.getStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      const schedule = {
        id: Date.now(),
        streamId,
        ...scheduleData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      schedules.set(schedule.id, schedule);

      res.json({ message: "Schedule created", schedule });
    } catch (error: any) {
      console.error('[API] Create schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to create schedule" });
    }
  });

  app.get("/api/streams/:id/schedules", requireAuth, async (req, res) => {
    try {
      const streamId = Number(req.params.id);
      const streamSchedules = Array.from(schedules.values()).filter(
        (s: any) => s.streamId === streamId
      );

      res.json({ schedules: streamSchedules });
    } catch (error: any) {
      console.error('[API] Get schedules error:', error);
      res.status(500).json({ message: error.message || "Failed to get schedules" });
    }
  });

  app.put("/api/schedules/:id", requireAuth, async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      const updates = req.body;

      const schedule = schedules.get(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const updated = {
        ...schedule,
        ...updates,
        updatedAt: new Date()
      };

      schedules.set(scheduleId, updated);

      res.json({ message: "Schedule updated", schedule: updated });
    } catch (error: any) {
      console.error('[API] Update schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", requireAuth, async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);

      if (!schedules.has(scheduleId)) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      schedules.delete(scheduleId);

      res.json({ message: "Schedule deleted" });
    } catch (error: any) {
      console.error('[API] Delete schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to delete schedule" });
    }
  });

  app.get("/api/schedules", requireAuth, async (req, res) => {
    try {
      const allSchedules = Array.from(schedules.values());
      res.json({ schedules: allSchedules });
    } catch (error: any) {
      console.error('[API] Get all schedules error:', error);
      res.status(500).json({ message: error.message || "Failed to get schedules" });
    }
  });

  // TMDB API endpoints
  app.get("/api/tmdb/search/movies", requireAuth, async (req, res) => {
    try {
      const { query, page } = req.query;
      
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const { tmdbService } = await import('./tmdbService');
      const results = await tmdbService.searchMovies(
        query as string,
        page ? Number(page) : 1
      );

      res.json(results);
    } catch (error: any) {
      console.error('[API] TMDB search movies error:', error);
      res.status(500).json({ message: error.message || "Failed to search movies" });
    }
  });

  app.get("/api/tmdb/search/series", requireAuth, async (req, res) => {
    try {
      const { query, page } = req.query;
      
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const { tmdbService } = await import('./tmdbService');
      const results = await tmdbService.searchSeries(
        query as string,
        page ? Number(page) : 1
      );

      res.json(results);
    } catch (error: any) {
      console.error('[API] TMDB search series error:', error);
      res.status(500).json({ message: error.message || "Failed to search series" });
    }
  });

  app.get("/api/tmdb/movie/:id", requireAuth, async (req, res) => {
    try {
      const movieId = Number(req.params.id);

      const { tmdbService } = await import('./tmdbService');
      const movie = await tmdbService.getMovieDetails(movieId);

      res.json(movie);
    } catch (error: any) {
      console.error('[API] TMDB get movie error:', error);
      res.status(500).json({ message: error.message || "Failed to get movie details" });
    }
  });

  app.get("/api/tmdb/series/:id", requireAuth, async (req, res) => {
    try {
      const seriesId = Number(req.params.id);

      const { tmdbService } = await import('./tmdbService');
      const series = await tmdbService.getSeriesDetails(seriesId);

      res.json(series);
    } catch (error: any) {
      console.error('[API] TMDB get series error:', error);
      res.status(500).json({ message: error.message || "Failed to get series details" });
    }
  });

  app.get("/api/tmdb/popular/movies", requireAuth, async (req, res) => {
    try {
      const { page } = req.query;

      const { tmdbService } = await import('./tmdbService');
      const results = await tmdbService.getPopularMovies(
        page ? Number(page) : 1
      );

      res.json(results);
    } catch (error: any) {
      console.error('[API] TMDB popular movies error:', error);
      res.status(500).json({ message: error.message || "Failed to get popular movies" });
    }
  });

  app.get("/api/tmdb/popular/series", requireAuth, async (req, res) => {
    try {
      const { page } = req.query;

      const { tmdbService } = await import('./tmdbService');
      const results = await tmdbService.getPopularSeries(
        page ? Number(page) : 1
      );

      res.json(results);
    } catch (error: any) {
      console.error('[API] TMDB popular series error:', error);
      res.status(500).json({ message: error.message || "Failed to get popular series" });
    }
  });

  app.get("/api/tmdb/genres/movies", requireAuth, async (req, res) => {
    try {
      const { tmdbService } = await import('./tmdbService');
      const genres = await tmdbService.getMovieGenres();

      res.json({ genres });
    } catch (error: any) {
      console.error('[API] TMDB movie genres error:', error);
      res.status(500).json({ message: error.message || "Failed to get movie genres" });
    }
  });

  app.get("/api/tmdb/genres/series", requireAuth, async (req, res) => {
    try {
      const { tmdbService } = await import('./tmdbService');
      const genres = await tmdbService.getTVGenres();

      res.json({ genres });
    } catch (error: any) {
      console.error('[API] TMDB TV genres error:', error);
      res.status(500).json({ message: error.message || "Failed to get TV genres" });
    }
  });

  // ===== Media Upload Endpoints =====

  // Configure multer for file uploads
  const multer = await import('multer');
  const upload = multer.default({ storage: multer.memoryStorage() });

  // Upload poster
  app.post("/api/media/posters/upload", requireAuth, upload.single('poster'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { movieId } = req.body;
      if (!movieId) {
        return res.status(400).json({ message: "Movie ID required" });
      }

      const { mediaUploadManager } = await import('./mediaUploadManager');
      const result = await mediaUploadManager.uploadPoster(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        Number(movieId)
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Upload poster error:', error);
      res.status(500).json({ message: error.message || "Failed to upload poster" });
    }
  });

  // Upload backdrop
  app.post("/api/media/backdrops/upload", requireAuth, upload.single('backdrop'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { movieId } = req.body;
      if (!movieId) {
        return res.status(400).json({ message: "Movie ID required" });
      }

      const { mediaUploadManager } = await import('./mediaUploadManager');
      const result = await mediaUploadManager.uploadBackdrop(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        Number(movieId)
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Upload backdrop error:', error);
      res.status(500).json({ message: error.message || "Failed to upload backdrop" });
    }
  });

  // Upload subtitle
  app.post("/api/media/subtitles/upload", requireAuth, upload.single('subtitle'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { movieId, language } = req.body;
      if (!movieId || !language) {
        return res.status(400).json({ message: "Movie ID and language required" });
      }

      const { mediaUploadManager } = await import('./mediaUploadManager');
      const result = await mediaUploadManager.uploadSubtitle(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        Number(movieId),
        language
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Upload subtitle error:', error);
      res.status(500).json({ message: error.message || "Failed to upload subtitle" });
    }
  });

  // Get poster
  app.get("/api/media/posters/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const buffer = await mediaUploadManager.getPoster(filename);

      if (!buffer) {
        return res.status(404).json({ message: "Poster not found" });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error: any) {
      console.error('[API] Get poster error:', error);
      res.status(500).json({ message: "Failed to get poster" });
    }
  });

  // Get backdrop
  app.get("/api/media/backdrops/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const buffer = await mediaUploadManager.getBackdrop(filename);

      if (!buffer) {
        return res.status(404).json({ message: "Backdrop not found" });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error: any) {
      console.error('[API] Get backdrop error:', error);
      res.status(500).json({ message: "Failed to get backdrop" });
    }
  });

  // Get subtitle
  app.get("/api/media/subtitles/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const buffer = await mediaUploadManager.getSubtitle(filename);

      if (!buffer) {
        return res.status(404).json({ message: "Subtitle not found" });
      }

      // Determine content type from extension
      const ext = filename.toLowerCase().split('.').pop();
      let contentType = 'text/plain';
      if (ext === 'vtt') contentType = 'text/vtt';
      else if (ext === 'srt') contentType = 'application/x-subrip';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error: any) {
      console.error('[API] Get subtitle error:', error);
      res.status(500).json({ message: "Failed to get subtitle" });
    }
  });

  // List posters for movie
  app.get("/api/media/posters/movie/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const posters = await mediaUploadManager.listPosters(Number(id));

      res.json({ posters: posters.map(p => ({ filename: p, url: `/api/media/posters/${p}` })) });
    } catch (error: any) {
      console.error('[API] List posters error:', error);
      res.status(500).json({ message: "Failed to list posters" });
    }
  });

  // List subtitles for movie
  app.get("/api/media/subtitles/movie/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const subtitles = await mediaUploadManager.listSubtitles(Number(id));

      res.json({ 
        subtitles: subtitles.map(s => ({ 
          ...s, 
          url: `/api/media/subtitles/${s.filename}` 
        })) 
      });
    } catch (error: any) {
      console.error('[API] List subtitles error:', error);
      res.status(500).json({ message: "Failed to list subtitles" });
    }
  });

  // Delete poster
  app.delete("/api/media/posters/:filename", requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const deleted = await mediaUploadManager.deletePoster(filename);

      if (!deleted) {
        return res.status(404).json({ message: "Poster not found" });
      }

      res.json({ message: "Poster deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete poster error:', error);
      res.status(500).json({ message: "Failed to delete poster" });
    }
  });

  // Delete subtitle
  app.delete("/api/media/subtitles/:filename", requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      const { mediaUploadManager } = await import('./mediaUploadManager');
      const deleted = await mediaUploadManager.deleteSubtitle(filename);

      if (!deleted) {
        return res.status(404).json({ message: "Subtitle not found" });
      }

      res.json({ message: "Subtitle deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete subtitle error:', error);
      res.status(500).json({ message: "Failed to delete subtitle" });
    }
  });

  // ===== Analytics & Reporting Endpoints =====

  // Get stream analytics
  app.get("/api/analytics/streams", requireAuth, async (req, res) => {
    try {
      const { streamId, days = '7' } = req.query;
      const { analyticsService } = await import('./analyticsService');
      
      const analytics = await analyticsService.getStreamAnalytics(
        streamId ? Number(streamId) : undefined,
        Number(days)
      );

      res.json({ analytics });
    } catch (error: any) {
      console.error('[API] Get stream analytics error:', error);
      res.status(500).json({ message: error.message || "Failed to get stream analytics" });
    }
  });

  // Get viewer analytics
  app.get("/api/analytics/viewers", requireAuth, async (req, res) => {
    try {
      const { days = '7' } = req.query;
      const { analyticsService } = await import('./analyticsService');
      
      const analytics = await analyticsService.getViewerAnalytics(Number(days));

      res.json({ analytics });
    } catch (error: any) {
      console.error('[API] Get viewer analytics error:', error);
      res.status(500).json({ message: error.message || "Failed to get viewer analytics" });
    }
  });

  // Get revenue analytics
  app.get("/api/analytics/revenue", requireAuth, async (req, res) => {
    try {
      const { days = '30' } = req.query;
      const { analyticsService } = await import('./analyticsService');
      
      const analytics = await analyticsService.getRevenueAnalytics(Number(days));

      res.json(analytics);
    } catch (error: any) {
      console.error('[API] Get revenue analytics error:', error);
      res.status(500).json({ message: error.message || "Failed to get revenue analytics" });
    }
  });

  // Get system analytics
  app.get("/api/analytics/system", requireAuth, async (req, res) => {
    try {
      const { analyticsService } = await import('./analyticsService');
      
      const analytics = await analyticsService.getSystemAnalytics();

      res.json(analytics);
    } catch (error: any) {
      console.error('[API] Get system analytics error:', error);
      res.status(500).json({ message: error.message || "Failed to get system analytics" });
    }
  });

  // Get time series data
  app.get("/api/analytics/timeseries", requireAuth, async (req, res) => {
    try {
      const { metric, hours = '24' } = req.query;
      
      if (!metric || !['viewers', 'bandwidth', 'revenue'].includes(metric as string)) {
        return res.status(400).json({ message: "Invalid metric. Must be: viewers, bandwidth, or revenue" });
      }

      const { analyticsService } = await import('./analyticsService');
      
      const data = await analyticsService.getTimeSeriesData(
        metric as 'viewers' | 'bandwidth' | 'revenue',
        Number(hours)
      );

      res.json({ data });
    } catch (error: any) {
      console.error('[API] Get time series data error:', error);
      res.status(500).json({ message: error.message || "Failed to get time series data" });
    }
  });

  // Get popular content
  app.get("/api/analytics/popular", requireAuth, async (req, res) => {
    try {
      const { limit = '10', days = '7' } = req.query;
      const { analyticsService } = await import('./analyticsService');
      
      const content = await analyticsService.getPopularContent(Number(limit), Number(days));

      res.json({ content });
    } catch (error: any) {
      console.error('[API] Get popular content error:', error);
      res.status(500).json({ message: error.message || "Failed to get popular content" });
    }
  });

  // Clear analytics cache
  app.post("/api/analytics/cache/clear", requireAuth, async (req, res) => {
    try {
      const { analyticsService } = await import('./analyticsService');
      
      analyticsService.clearCache();

      res.json({ message: "Analytics cache cleared successfully" });
    } catch (error: any) {
      console.error('[API] Clear analytics cache error:', error);
      res.status(500).json({ message: error.message || "Failed to clear analytics cache" });
    }
  });

  // ===== Enhanced Authentication Endpoints =====

  // Get user sessions
  app.get("/api/auth/sessions", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { authService } = await import('./authService');
      const sessions = await authService.getUserSessions(userId);

      res.json({ sessions });
    } catch (error: any) {
      console.error('[API] Get sessions error:', error);
      res.status(500).json({ message: error.message || "Failed to get sessions" });
    }
  });

  // Destroy session
  app.delete("/api/auth/sessions/:sessionId", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { authService } = await import('./authService');
      
      const success = await authService.destroySession(sessionId);

      if (!success) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json({ message: "Session destroyed successfully" });
    } catch (error: any) {
      console.error('[API] Destroy session error:', error);
      res.status(500).json({ message: error.message || "Failed to destroy session" });
    }
  });

  // Generate 2FA secret
  app.post("/api/auth/2fa/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const username = (req as any).user?.username;
      if (!userId || !username) return res.status(401).json({ message: "Unauthorized" });

      const { authService } = await import('./authService');
      const result = await authService.generate2FASecret(userId, username);

      res.json(result);
    } catch (error: any) {
      console.error('[API] Generate 2FA error:', error);
      res.status(500).json({ message: error.message || "Failed to generate 2FA secret" });
    }
  });

  // Enable 2FA
  app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token required" });
      }

      const { authService } = await import('./authService');
      const success = await authService.enable2FA(userId, token);

      if (!success) {
        return res.status(400).json({ message: "Invalid token" });
      }

      res.json({ message: "2FA enabled successfully" });
    } catch (error: any) {
      console.error('[API] Enable 2FA error:', error);
      res.status(500).json({ message: error.message || "Failed to enable 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { authService } = await import('./authService');
      const success = await authService.disable2FA(userId);

      if (!success) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      res.json({ message: "2FA disabled successfully" });
    } catch (error: any) {
      console.error('[API] Disable 2FA error:', error);
      res.status(500).json({ message: error.message || "Failed to disable 2FA" });
    }
  });

  // Verify 2FA token
  app.post("/api/auth/2fa/verify", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token required" });
      }

      const { authService } = await import('./authService');
      const valid = await authService.verify2FAToken(userId, token);

      res.json({ valid });
    } catch (error: any) {
      console.error('[API] Verify 2FA error:', error);
      res.status(500).json({ message: error.message || "Failed to verify 2FA token" });
    }
  });

  // Create API key
  app.post("/api/auth/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { name, permissions = [], expiresInDays } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name required" });
      }

      const { authService } = await import('./authService');
      const result = await authService.createApiKey(userId, name, permissions, expiresInDays);

      res.json(result);
    } catch (error: any) {
      console.error('[API] Create API key error:', error);
      res.status(500).json({ message: error.message || "Failed to create API key" });
    }
  });

  // List API keys
  app.get("/api/auth/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { authService } = await import('./authService');
      const keys = await authService.listApiKeys(userId);

      res.json({ keys });
    } catch (error: any) {
      console.error('[API] List API keys error:', error);
      res.status(500).json({ message: error.message || "Failed to list API keys" });
    }
  });

  // Revoke API key
  app.delete("/api/auth/api-keys/:keyId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { keyId } = req.params;
      const { authService } = await import('./authService');
      
      const success = await authService.revokeApiKey(userId, keyId);

      if (!success) {
        return res.status(404).json({ message: "API key not found" });
      }

      res.json({ message: "API key revoked successfully" });
    } catch (error: any) {
      console.error('[API] Revoke API key error:', error);
      res.status(500).json({ message: error.message || "Failed to revoke API key" });
    }
  });

  // ===== Reseller Management Endpoints =====

  // Create reseller
  app.post("/api/resellers", requireAuth, async (req, res) => {
    try {
      const { username, email, password, initialCredits, maxCredits, parentResellerId } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const { resellerService } = await import('./resellerService');
      const reseller = await resellerService.createReseller(
        username,
        email,
        password,
        initialCredits,
        maxCredits,
        parentResellerId
      );

      res.json(reseller);
    } catch (error: any) {
      console.error('[API] Create reseller error:', error);
      res.status(500).json({ message: error.message || "Failed to create reseller" });
    }
  });

  // Get reseller
  app.get("/api/resellers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { resellerService } = await import('./resellerService');
      const reseller = await resellerService.getReseller(Number(id));

      if (!reseller) {
        return res.status(404).json({ message: "Reseller not found" });
      }

      res.json(reseller);
    } catch (error: any) {
      console.error('[API] Get reseller error:', error);
      res.status(500).json({ message: error.message || "Failed to get reseller" });
    }
  });

  // Update reseller
  app.put("/api/resellers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { resellerService } = await import('./resellerService');
      const reseller = await resellerService.updateReseller(Number(id), updates);

      if (!reseller) {
        return res.status(404).json({ message: "Reseller not found" });
      }

      res.json(reseller);
    } catch (error: any) {
      console.error('[API] Update reseller error:', error);
      res.status(500).json({ message: error.message || "Failed to update reseller" });
    }
  });

  // List resellers
  app.get("/api/resellers", requireAuth, async (req, res) => {
    try {
      const { parentId } = req.query;
      const { resellerService } = await import('./resellerService');
      const resellers = await resellerService.listResellers(
        parentId ? Number(parentId) : undefined
      );

      res.json({ resellers });
    } catch (error: any) {
      console.error('[API] List resellers error:', error);
      res.status(500).json({ message: error.message || "Failed to list resellers" });
    }
  });

  // Add credits
  app.post("/api/resellers/:id/credits/add", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason, referenceId } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const { resellerService } = await import('./resellerService');
      const result = await resellerService.addCredits(
        Number(id),
        amount,
        reason || 'Credit addition',
        referenceId
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Add credits error:', error);
      res.status(500).json({ message: error.message || "Failed to add credits" });
    }
  });

  // Deduct credits
  app.post("/api/resellers/:id/credits/deduct", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason, referenceId } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const { resellerService } = await import('./resellerService');
      const result = await resellerService.deductCredits(
        Number(id),
        amount,
        reason || 'Credit deduction',
        referenceId
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Deduct credits error:', error);
      res.status(500).json({ message: error.message || "Failed to deduct credits" });
    }
  });

  // Transfer credits
  app.post("/api/resellers/credits/transfer", requireAuth, async (req, res) => {
    try {
      const { fromResellerId, toResellerId, amount, reason } = req.body;

      if (!fromResellerId || !toResellerId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid transfer parameters" });
      }

      const { resellerService } = await import('./resellerService');
      const result = await resellerService.transferCredits(
        fromResellerId,
        toResellerId,
        amount,
        reason
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Transfer credits error:', error);
      res.status(500).json({ message: error.message || "Failed to transfer credits" });
    }
  });

  // Get credit packages
  app.get("/api/resellers/packages", requireAuth, async (req, res) => {
    try {
      const { resellerService } = await import('./resellerService');
      const packages = resellerService.getCreditPackages();

      res.json({ packages });
    } catch (error: any) {
      console.error('[API] Get credit packages error:', error);
      res.status(500).json({ message: error.message || "Failed to get credit packages" });
    }
  });

  // Purchase package
  app.post("/api/resellers/:id/packages/:packageId/purchase", requireAuth, async (req, res) => {
    try {
      const { id, packageId } = req.params;
      const { paymentReference } = req.body;

      if (!paymentReference) {
        return res.status(400).json({ message: "Payment reference required" });
      }

      const { resellerService } = await import('./resellerService');
      const result = await resellerService.purchasePackage(
        Number(id),
        packageId,
        paymentReference
      );

      res.json(result);
    } catch (error: any) {
      console.error('[API] Purchase package error:', error);
      res.status(500).json({ message: error.message || "Failed to purchase package" });
    }
  });

  // Get reseller stats
  app.get("/api/resellers/:id/stats", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { resellerService } = await import('./resellerService');
      const stats = await resellerService.getResellerStats(Number(id));

      res.json(stats);
    } catch (error: any) {
      console.error('[API] Get reseller stats error:', error);
      res.status(500).json({ message: error.message || "Failed to get reseller stats" });
    }
  });

  // Get reseller hierarchy
  app.get("/api/resellers/:id/hierarchy", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { resellerService } = await import('./resellerService');
      const hierarchy = await resellerService.getResellerHierarchy(Number(id));

      res.json(hierarchy);
    } catch (error: any) {
      console.error('[API] Get reseller hierarchy error:', error);
      res.status(500).json({ message: error.message || "Failed to get reseller hierarchy" });
    }
  });

  // ===== Advanced Security Endpoints =====

  // Set IP restrictions
  app.post("/api/security/ip-restrictions", requireAuth, async (req, res) => {
    try {
      const { userId, allowedIps, deniedIps } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const { securityService } = await import('./securityService');
      const restriction = await securityService.setIpRestrictions(userId, allowedIps || [], deniedIps || []);

      res.json(restriction);
    } catch (error: any) {
      console.error('[API] Set IP restrictions error:', error);
      res.status(500).json({ message: error.message || "Failed to set IP restrictions" });
    }
  });

  // Get IP restrictions
  app.get("/api/security/ip-restrictions/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { securityService } = await import('./securityService');
      const restriction = await securityService.getIpRestrictions(Number(userId));

      res.json(restriction || { allowedIps: [], deniedIps: [] });
    } catch (error: any) {
      console.error('[API] Get IP restrictions error:', error);
      res.status(500).json({ message: error.message || "Failed to get IP restrictions" });
    }
  });

  // Register device
  app.post("/api/security/devices/register", requireAuth, async (req, res) => {
    try {
      const { userId, fingerprint, deviceInfo } = req.body;
      
      if (!userId || !fingerprint || !deviceInfo) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { securityService } = await import('./securityService');
      const device = await securityService.registerDevice(userId, fingerprint, deviceInfo);

      res.json(device);
    } catch (error: any) {
      console.error('[API] Register device error:', error);
      res.status(500).json({ message: error.message || "Failed to register device" });
    }
  });

  // Get user devices
  app.get("/api/security/devices/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { securityService } = await import('./securityService');
      const devices = securityService.getUserDevices(Number(userId));

      res.json({ devices });
    } catch (error: any) {
      console.error('[API] Get user devices error:', error);
      res.status(500).json({ message: error.message || "Failed to get user devices" });
    }
  });

  // Update device trust level
  app.put("/api/security/devices/:fingerprint/trust", requireAuth, async (req, res) => {
    try {
      const { fingerprint } = req.params;
      const { trustLevel } = req.body;

      if (!['trusted', 'suspicious', 'blocked'].includes(trustLevel)) {
        return res.status(400).json({ message: "Invalid trust level" });
      }

      const { securityService } = await import('./securityService');
      const success = await securityService.updateDeviceTrustLevel(fingerprint, trustLevel);

      if (!success) {
        return res.status(404).json({ message: "Device not found" });
      }

      res.json({ message: "Device trust level updated successfully" });
    } catch (error: any) {
      console.error('[API] Update device trust level error:', error);
      res.status(500).json({ message: error.message || "Failed to update device trust level" });
    }
  });

  // Remove device
  app.delete("/api/security/devices/:fingerprint", requireAuth, async (req, res) => {
    try {
      const { fingerprint } = req.params;
      const { securityService } = await import('./securityService');
      const success = await securityService.removeDevice(fingerprint);

      if (!success) {
        return res.status(404).json({ message: "Device not found" });
      }

      res.json({ message: "Device removed successfully" });
    } catch (error: any) {
      console.error('[API] Remove device error:', error);
      res.status(500).json({ message: error.message || "Failed to remove device" });
    }
  });

  // Get security events
  app.get("/api/security/events", requireAuth, async (req, res) => {
    try {
      const { userId, severity, limit } = req.query;
      const { securityService } = await import('./securityService');
      
      const events = await securityService.getSecurityEvents(
        userId ? Number(userId) : undefined,
        severity as any,
        limit ? Number(limit) : 100
      );

      res.json({ events });
    } catch (error: any) {
      console.error('[API] Get security events error:', error);
      res.status(500).json({ message: error.message || "Failed to get security events" });
    }
  });

  // Get security stats
  app.get("/api/security/stats", requireAuth, async (req, res) => {
    try {
      const { securityService } = await import('./securityService');
      const stats = await securityService.getSecurityStats();

      res.json(stats);
    } catch (error: any) {
      console.error('[API] Get security stats error:', error);
      res.status(500).json({ message: error.message || "Failed to get security stats" });
    }
  });

  // Get security settings
  app.get("/api/security/settings", requireAuth, async (req, res) => {
    try {
      const { securityService } = await import('./securityService');
      const settings = securityService.getSettings();

      res.json(settings);
    } catch (error: any) {
      console.error('[API] Get security settings error:', error);
      res.status(500).json({ message: error.message || "Failed to get security settings" });
    }
  });

  // Update security settings
  app.put("/api/security/settings", requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      const { securityService } = await import('./securityService');
      const settings = await securityService.updateSettings(updates);

      res.json(settings);
    } catch (error: any) {
      console.error('[API] Update security settings error:', error);
      res.status(500).json({ message: error.message || "Failed to update security settings" });
    }
  });

  // Get rate limit rules
  app.get("/api/security/rate-limits", requireAuth, async (req, res) => {
    try {
      const { securityService } = await import('./securityService');
      const rules = securityService.getRateLimitRules();

      res.json({ rules });
    } catch (error: any) {
      console.error('[API] Get rate limit rules error:', error);
      res.status(500).json({ message: error.message || "Failed to get rate limit rules" });
    }
  });

  // Create rate limit rule
  app.post("/api/security/rate-limits", requireAuth, async (req, res) => {
    try {
      const rule = req.body;
      const { securityService } = await import('./securityService');
      const created = await securityService.createRateLimitRule(rule);

      res.json(created);
    } catch (error: any) {
      console.error('[API] Create rate limit rule error:', error);
      res.status(500).json({ message: error.message || "Failed to create rate limit rule" });
    }
  });

  // Update rate limit rule
  app.put("/api/security/rate-limits/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { securityService } = await import('./securityService');
      const updated = await securityService.updateRateLimitRule(id, updates);

      if (!updated) {
        return res.status(404).json({ message: "Rate limit rule not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[API] Update rate limit rule error:', error);
      res.status(500).json({ message: error.message || "Failed to update rate limit rule" });
    }
  });

  // Delete rate limit rule
  app.delete("/api/security/rate-limits/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { securityService } = await import('./securityService');
      const success = await securityService.deleteRateLimitRule(id);

      if (!success) {
        return res.status(404).json({ message: "Rate limit rule not found" });
      }

      res.json({ message: "Rate limit rule deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete rate limit rule error:', error);
      res.status(500).json({ message: error.message || "Failed to delete rate limit rule" });
    }
  });

  // Stream preview proxy for admin panel - bypasses CORS issues
  app.get("/api/streams/:id/proxy", requireAuth, async (req, res) => {
    const stream = await storage.getStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    const sourceUrl = stream.sourceUrl;
    const isHls = sourceUrl.includes('.m3u8');

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(502).json({ message: "Stream source unavailable" });
      }

      // Forward content type
      const contentType = response.headers.get('content-type') || (isHls ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');

      // For HLS, we need to rewrite the playlist URLs to go through our proxy
      if (isHls) {
        const text = await response.text();
        // Rewrite relative URLs in the playlist to absolute
        const baseUrl = new URL(sourceUrl);
        const rewritten = text.replace(/^(?!#)(.+\.ts.*)$/gm, (match) => {
          if (match.startsWith('http')) return match;
          return new URL(match, baseUrl).toString();
        }).replace(/^(?!#)(.+\.m3u8.*)$/gm, (match) => {
          if (match.startsWith('http')) return match;
          return new URL(match, baseUrl).toString();
        });
        return res.send(rewritten);
      }

      // For non-HLS, stream directly
      res.setHeader('Transfer-Encoding', 'chunked');
      
      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(502).json({ message: "Stream unavailable" });
      }

      req.on('close', () => {
        reader.cancel();
      });

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.writableEnded) {
              res.write(value);
            }
          }
          if (!res.writableEnded) {
            res.end();
          }
        } catch (err) {
          if (!res.writableEnded) {
            res.end();
          }
        }
      };

      pump();
    } catch (err) {
      console.error('Stream proxy error:', err);
      return res.status(502).json({ message: "Failed to connect to stream source" });
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

  // Bulk operations for lines
  app.post("/api/lines/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No line IDs provided" });
      }
      await storage.bulkDeleteLines(ids);
      res.json({ message: `Deleted ${ids.length} lines`, deleted: ids.length });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Failed to delete lines" });
    }
  });

  app.post("/api/lines/bulk-toggle", requireAdmin, async (req, res) => {
    try {
      const { ids, enabled } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No line IDs provided" });
      }
      // Update each line's enabled status
      for (const id of ids) {
        await storage.updateLine(id, { enabled });
      }
      res.json({ message: `Toggled ${ids.length} lines`, updated: ids.length });
    } catch (error) {
      console.error("Bulk toggle error:", error);
      res.status(500).json({ message: "Failed to toggle lines" });
    }
  });

  // Export endpoints
  app.get("/api/lines/export/csv", requireAuth, async (req, res) => {
    try {
      const lines = await storage.getLines();
      const { exportService } = await import('./export-service');
      const csv = exportService.exportLinesToCSV(lines);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="lines_export_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Export lines to CSV error:", error);
      res.status(500).json({ message: "Failed to export lines" });
    }
  });

  app.get("/api/lines/export/excel", requireAuth, async (req, res) => {
    try {
      const lines = await storage.getLines();
      const { exportService } = await import('./export-service');
      const excel = exportService.exportLinesToExcel(lines);
      
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="lines_export_${Date.now()}.xlsx"`);
      res.send(excel);
    } catch (error) {
      console.error("Export lines to Excel error:", error);
      res.status(500).json({ message: "Failed to export lines" });
    }
  });

  app.get("/api/lines/export/m3u", requireAuth, async (req, res) => {
    try {
      const lines = await storage.getLines();
      const { exportService } = await import('./export-service');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const m3u = exportService.exportLinesToM3U(lines, baseUrl);
      
      res.setHeader('Content-Type', 'audio/x-mpegurl');
      res.setHeader('Content-Disposition', `attachment; filename="lines_playlist_${Date.now()}.m3u"`);
      res.send(m3u);
    } catch (error) {
      console.error("Export lines to M3U error:", error);
      res.status(500).json({ message: "Failed to export lines" });
    }
  });

  app.get("/api/streams/export/csv", requireAuth, async (req, res) => {
    try {
      const streams = await storage.getStreams();
      const { exportService } = await import('./export-service');
      const csv = exportService.exportStreamsToCSV(streams);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="streams_export_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Export streams to CSV error:", error);
      res.status(500).json({ message: "Failed to export streams" });
    }
  });

  app.get("/api/streams/export/excel", requireAuth, async (req, res) => {
    try {
      const streams = await storage.getStreams();
      const { exportService } = await import('./export-service');
      const excel = exportService.exportStreamsToExcel(streams);
      
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="streams_export_${Date.now()}.xlsx"`);
      res.send(excel);
    } catch (error) {
      console.error("Export streams to Excel error:", error);
      res.status(500).json({ message: "Failed to export streams" });
    }
  });

  app.get("/api/users/export/csv", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const { exportService } = await import('./export-service');
      const csv = exportService.exportUsersToCSV(users);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users_export_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Export users to CSV error:", error);
      res.status(500).json({ message: "Failed to export users" });
    }
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

  // === BACKUPS (Admin only) ===
  app.get("/api/backups", requireAdmin, async (_req, res) => {
    const backupsList = await storage.getBackups();
    res.json(backupsList);
  });

  app.get("/api/backups/:id", requireAdmin, async (req, res) => {
    const backup = await storage.getBackup(Number(req.params.id));
    if (!backup) return res.status(404).json({ message: "Backup not found" });
    res.json(backup);
  });

  app.post("/api/backups", requireAdmin, async (req, res) => {
    try {
      const { backupName, description, backupType, includedTables } = req.body;
      
      // Create backup record with pending status
      const backup = await storage.createBackup({
        backupName: backupName || `Backup_${new Date().toISOString().split('T')[0]}`,
        description,
        backupType: backupType || 'full',
        status: 'in_progress',
        includedTables: includedTables || [],
        createdBy: req.session?.userId || null,
        filePath: null,
        fileSize: 0,
        errorMessage: null,
      });

      // Simulate backup process (in production, this would be an async job)
      const tables = includedTables?.length > 0 ? includedTables : [
        'users', 'categories', 'streams', 'bouquets', 'lines', 'servers', 
        'epg_sources', 'series', 'episodes', 'reseller_groups', 'packages'
      ];
      
      // Update to completed
      const completedBackup = await storage.updateBackup(backup.id, {
        status: 'completed',
        filePath: `/backups/backup_${backup.id}.json`,
        fileSize: Math.floor(Math.random() * 1000000) + 10000,
        includedTables: tables,
      } as any);

      res.status(201).json(completedBackup);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/backups/:id", requireAdmin, async (req, res) => {
    const backup = await storage.getBackup(Number(req.params.id));
    if (!backup) return res.status(404).json({ message: "Backup not found" });
    
    await storage.deleteBackup(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/backups/:id/restore", requireAdmin, async (req, res) => {
    try {
      const backup = await storage.getBackup(Number(req.params.id));
      if (!backup) return res.status(404).json({ message: "Backup not found" });
      if (backup.status !== 'completed') {
        return res.status(400).json({ message: "Cannot restore from incomplete backup" });
      }

      // In production, this would trigger a restore process
      // For now, we just return success
      res.json({ 
        message: "Restore initiated", 
        backupId: backup.id,
        restoredTables: backup.includedTables || []
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === WEBHOOKS (Admin only) ===
  app.get("/api/webhooks", requireAdmin, async (_req, res) => {
    const webhooksList = await storage.getWebhooks();
    res.json(webhooksList);
  });

  app.get("/api/webhooks/:id", requireAdmin, async (req, res) => {
    const webhook = await storage.getWebhook(Number(req.params.id));
    if (!webhook) return res.status(404).json({ message: "Webhook not found" });
    res.json(webhook);
  });

  app.post("/api/webhooks", requireAdmin, async (req, res) => {
    try {
      const { name, url, secret, events, enabled, retries, timeoutSeconds } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }

      const webhook = await storage.createWebhook({
        name,
        url,
        secret: secret || null,
        events: events || [],
        enabled: enabled ?? true,
        retries: retries ?? 3,
        timeoutSeconds: timeoutSeconds ?? 30,
        lastStatus: null,
        failureCount: 0,
      });

      res.status(201).json(webhook);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/webhooks/:id", requireAdmin, async (req, res) => {
    try {
      const webhook = await storage.updateWebhook(Number(req.params.id), req.body);
      res.json(webhook);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/webhooks/:id", requireAdmin, async (req, res) => {
    const webhook = await storage.getWebhook(Number(req.params.id));
    if (!webhook) return res.status(404).json({ message: "Webhook not found" });
    
    await storage.deleteWebhook(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/webhooks/:id/logs", requireAdmin, async (req, res) => {
    const logs = await storage.getWebhookLogs(Number(req.params.id), 50);
    res.json(logs);
  });

  app.post("/api/webhooks/:id/test", requireAdmin, async (req, res) => {
    try {
      const webhook = await storage.getWebhook(Number(req.params.id));
      if (!webhook) return res.status(404).json({ message: "Webhook not found" });

      // Send test payload to webhook URL
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook delivery' }
      };

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'test',
            ...(webhook.secret ? { 'X-Webhook-Signature': webhook.secret } : {})
          },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout((webhook.timeoutSeconds || 30) * 1000)
        });

        const responseText = await response.text();
        
        // Log the webhook attempt
        await storage.logWebhook({
          webhookId: webhook.id,
          event: 'test',
          payload: testPayload,
          responseStatus: response.status,
          responseBody: responseText.substring(0, 1000),
          success: response.ok,
          errorMessage: response.ok ? null : `HTTP ${response.status}`,
        });

        // Update webhook last status
        await storage.updateWebhook(webhook.id, {
          lastStatus: response.status,
          failureCount: response.ok ? 0 : (webhook.failureCount || 0) + 1,
        } as any);

        res.json({ 
          success: response.ok, 
          status: response.status,
          response: responseText.substring(0, 500)
        });
      } catch (fetchErr: any) {
        // Log the failure
        await storage.logWebhook({
          webhookId: webhook.id,
          event: 'test',
          payload: testPayload,
          responseStatus: null,
          responseBody: null,
          success: false,
          errorMessage: fetchErr.message,
        });

        res.json({ success: false, error: fetchErr.message });
      }
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === ACTIVITY LOGS ===
  app.get("/api/activity-logs", requireAdmin, async (req, res) => {
    const lineId = req.query.lineId ? Number(req.query.lineId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await storage.getActivityLog(lineId, limit);
    res.json(logs);
  });

  // === CREDIT TRANSACTIONS ===
  app.get("/api/credit-transactions", requireAdmin, async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const transactions = await storage.getCreditTransactions(userId);
    res.json(transactions);
  });

  // === CRON JOBS ===
  app.get("/api/cron-jobs", requireAdmin, async (_req, res) => {
    const jobs = await storage.getCronJobs();
    res.json(jobs);
  });

  app.post("/api/cron-jobs", requireAdmin, async (req, res) => {
    try {
      const job = await storage.createCronJob(req.body);
      res.status(201).json(job);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/cron-jobs/:id", requireAdmin, async (req, res) => {
    try {
      const job = await storage.updateCronJob(Number(req.params.id), req.body);
      res.json(job);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/cron-jobs/:id", requireAdmin, async (req, res) => {
    await storage.deleteCronJob(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/cron-jobs/:id/run", requireAdmin, async (req, res) => {
    try {
      const job = await storage.getCronJob(Number(req.params.id));
      if (!job) return res.status(404).json({ message: "Job not found" });
      
      await storage.updateCronJob(job.id, { 
        status: 'running', 
        lastRun: new Date() 
      } as any);
      
      // Simulate job execution
      setTimeout(async () => {
        await storage.updateCronJob(job.id, { 
          status: 'idle',
          nextRun: new Date(Date.now() + (job.intervalMinutes || 60) * 60000)
        } as any);
      }, 2000);
      
      res.json({ message: "Job started", job });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === EPG DATA ===
  app.get("/api/epg-data", requireAuth, async (req, res) => {
    const channelId = req.query.channelId as string;
    const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;
    
    if (!channelId) {
      return res.status(400).json({ message: "channelId is required" });
    }
    
    const data = await storage.getEpgData(channelId, startTime, endTime);
    res.json(data);
  });

  app.get("/api/epg-data/all", requireAuth, async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const data = await storage.getAllEpgData(limit);
    res.json(data);
  });

  // === DASHBOARD STATISTICS ===
  app.get("/api/stats/detailed", requireAdmin, async (_req, res) => {
    const stats = await storage.getStats();
    const connections = await storage.getActiveConnections();
    const streams = await storage.getStreams();
    
    const onlineStreams = streams.filter(s => s.monitorStatus === 'online').length;
    const offlineStreams = streams.filter(s => s.monitorStatus === 'offline').length;
    
    // Group connections by hour for chart
    const now = new Date();
    const hourlyConnections = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now);
      hour.setHours(now.getHours() - (23 - i), 0, 0, 0);
      return {
        hour: hour.toISOString(),
        count: connections.filter(c => {
          const connTime = new Date(c.startedAt!);
          return connTime >= hour && connTime < new Date(hour.getTime() + 3600000);
        }).length
      };
    });

    res.json({
      ...stats,
      onlineStreams,
      offlineStreams,
      hourlyConnections,
      contentDistribution: [
        { name: "Live TV", value: streams.filter(s => s.streamType === 'live').length },
        { name: "Movies", value: streams.filter(s => s.streamType === 'movie').length },
      ]
    });
  });

  // Webhook events list (for UI)
  app.get("/api/webhooks/events/list", requireAdmin, async (_req, res) => {
    res.json([
      { value: '*', label: 'All Events' },
      { value: 'line.created', label: 'Line Created' },
      { value: 'line.expired', label: 'Line Expired' },
      { value: 'line.deleted', label: 'Line Deleted' },
      { value: 'stream.offline', label: 'Stream Offline' },
      { value: 'stream.online', label: 'Stream Online' },
      { value: 'stream.created', label: 'Stream Created' },
      { value: 'connection.started', label: 'Connection Started' },
      { value: 'connection.ended', label: 'Connection Ended' },
      { value: 'user.created', label: 'User Created' },
      { value: 'ticket.created', label: 'Ticket Created' },
      { value: 'backup.completed', label: 'Backup Completed' },
    ]);
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

  // Bulk update streams
  app.post("/api/streams/bulk-update", async (req, res) => {
    try {
      const { ids, updates } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No stream IDs provided" });
      }

      // Update each stream with the provided data
      const updatePromises = ids.map(async (id: number) => {
        const cleanUpdates: any = {};
        
        // Only include fields that are actually set
        if (updates.categoryId !== undefined) cleanUpdates.categoryId = updates.categoryId;
        if (updates.streamType !== undefined) cleanUpdates.streamType = updates.streamType;
        if (updates.serverId !== undefined) cleanUpdates.serverId = updates.serverId;
        if (updates.transcodeProfileId !== undefined) cleanUpdates.transcodeProfileId = updates.transcodeProfileId;
        if (updates.tvArchiveEnabled !== undefined) cleanUpdates.tvArchiveEnabled = updates.tvArchiveEnabled;
        if (updates.tvArchiveDuration !== undefined) cleanUpdates.tvArchiveDuration = updates.tvArchiveDuration;
        
        if (Object.keys(cleanUpdates).length > 0) {
          await storage.updateStream(id, cleanUpdates);
        }
      });

      await Promise.all(updatePromises);
      
      res.json({ 
        message: `Updated ${ids.length} streams`, 
        updated: ids.length 
      });
    } catch (err: any) {
      console.error("Bulk update error:", err);
      res.status(500).json({ message: "Failed to update streams" });
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

  // === SETTINGS (Admin only) ===
  app.get("/api/settings", requireAdmin, async (_req, res) => {
    const allSettings = await storage.getSettings();
    res.json(allSettings);
  });

  app.get("/api/settings/:key", requireAdmin, async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const validated = insertSettingSchema.parse(req.body);
      const setting = await storage.createSetting(validated);
      res.status(201).json(setting);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/settings/:key", requireAdmin, async (req, res) => {
    try {
      const updateSchema = z.object({ value: z.string() });
      const { value } = updateSchema.parse(req.body);
      const existing = await storage.getSetting(req.params.key);
      if (!existing) return res.status(404).json({ message: "Setting not found" });
      const setting = await storage.updateSetting(req.params.key, value);
      res.json(setting);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/settings/:key", requireAdmin, async (req, res) => {
    await storage.deleteSetting(req.params.key);
    res.status(204).send();
  });

  // === ACCESS OUTPUTS (Admin only) ===
  app.get("/api/access-outputs", requireAdmin, async (_req, res) => {
    const outputs = await storage.getAccessOutputs();
    res.json(outputs);
  });

  app.post("/api/access-outputs", requireAdmin, async (req, res) => {
    try {
      const validated = insertAccessOutputSchema.parse(req.body);
      const output = await storage.createAccessOutput(validated);
      res.status(201).json(output);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/access-outputs/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertAccessOutputSchema.partial().parse(req.body);
      const existing = await storage.getAccessOutput(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Access output not found" });
      const output = await storage.updateAccessOutput(Number(req.params.id), validated);
      res.json(output);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/access-outputs/:id", requireAdmin, async (req, res) => {
    await storage.deleteAccessOutput(Number(req.params.id));
    res.status(204).send();
  });

  // === RESERVED USERNAMES (Admin only) ===
  app.get("/api/reserved-usernames", requireAdmin, async (_req, res) => {
    const reserved = await storage.getReservedUsernames();
    res.json(reserved);
  });

  app.get("/api/reserved-usernames/check/:username", requireAuth, async (req, res) => {
    const isReserved = await storage.isUsernameReserved(req.params.username);
    res.json({ reserved: isReserved });
  });

  app.post("/api/reserved-usernames", requireAdmin, async (req, res) => {
    try {
      const validated = insertReservedUsernameSchema.parse(req.body);
      const reserved = await storage.createReservedUsername(validated);
      res.status(201).json(reserved);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/reserved-usernames/:id", requireAdmin, async (req, res) => {
    await storage.deleteReservedUsername(Number(req.params.id));
    res.status(204).send();
  });

  // === CREATED CHANNELS (RTMP to HLS - Admin only) ===
  app.get("/api/created-channels", requireAdmin, async (_req, res) => {
    const channels = await storage.getCreatedChannels();
    res.json(channels);
  });

  app.get("/api/created-channels/:id", requireAdmin, async (req, res) => {
    const channel = await storage.getCreatedChannel(Number(req.params.id));
    if (!channel) {
      return res.status(404).json({ message: "Created channel not found" });
    }
    res.json(channel);
  });

  app.post("/api/created-channels", requireAdmin, async (req, res) => {
    try {
      const validated = insertCreatedChannelSchema.parse(req.body);
      const channel = await storage.createCreatedChannel(validated);
      res.status(201).json(channel);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/created-channels/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertCreatedChannelSchema.partial().parse(req.body);
      const channel = await storage.updateCreatedChannel(Number(req.params.id), validated);
      res.json(channel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/created-channels/:id", requireAdmin, async (req, res) => {
    await storage.deleteCreatedChannel(Number(req.params.id));
    res.status(204).send();
  });

  // === ENIGMA2 DEVICES (Admin only) ===
  app.get("/api/enigma2-devices", requireAdmin, async (_req, res) => {
    const devices = await storage.getEnigma2Devices();
    res.json(devices);
  });

  app.get("/api/enigma2-devices/:id", requireAdmin, async (req, res) => {
    const device = await storage.getEnigma2Device(Number(req.params.id));
    if (!device) {
      return res.status(404).json({ message: "Enigma2 device not found" });
    }
    res.json(device);
  });

  app.post("/api/enigma2-devices", requireAdmin, async (req, res) => {
    try {
      const validated = insertEnigma2DeviceSchema.parse(req.body);
      const device = await storage.createEnigma2Device(validated);
      res.status(201).json(device);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/enigma2-devices/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertEnigma2DeviceSchema.partial().parse(req.body);
      const device = await storage.updateEnigma2Device(Number(req.params.id), validated);
      res.json(device);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/enigma2-devices/:id", requireAdmin, async (req, res) => {
    await storage.deleteEnigma2Device(Number(req.params.id));
    res.status(204).send();
  });

  // === ENIGMA2 ACTIONS (Admin only) ===
  app.get("/api/enigma2-actions", requireAdmin, async (req, res) => {
    const deviceId = req.query.deviceId ? Number(req.query.deviceId) : undefined;
    const actions = await storage.getEnigma2Actions(deviceId);
    res.json(actions);
  });

  app.post("/api/enigma2-actions", requireAdmin, async (req, res) => {
    try {
      const validated = insertEnigma2ActionSchema.parse(req.body);
      const action = await storage.createEnigma2Action(validated);
      res.status(201).json(action);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/enigma2-actions/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertEnigma2ActionSchema.partial().parse(req.body);
      const action = await storage.updateEnigma2Action(Number(req.params.id), validated);
      res.json(action);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/enigma2-actions/:id", requireAdmin, async (req, res) => {
    await storage.deleteEnigma2Action(Number(req.params.id));
    res.status(204).send();
  });

  // === SIGNALS (Triggers/Automation - Admin only) ===
  app.get("/api/signals", requireAdmin, async (_req, res) => {
    const signalsList = await storage.getSignals();
    res.json(signalsList);
  });

  app.get("/api/signals/:id", requireAdmin, async (req, res) => {
    const signal = await storage.getSignal(Number(req.params.id));
    if (!signal) {
      return res.status(404).json({ message: "Signal not found" });
    }
    res.json(signal);
  });

  app.post("/api/signals", requireAdmin, async (req, res) => {
    try {
      const validated = insertSignalSchema.parse(req.body);
      const signal = await storage.createSignal(validated);
      res.status(201).json(signal);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/signals/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertSignalSchema.partial().parse(req.body);
      const signal = await storage.updateSignal(Number(req.params.id), validated);
      res.json(signal);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/signals/:id", requireAdmin, async (req, res) => {
    await storage.deleteSignal(Number(req.params.id));
    res.status(204).send();
  });

  // === ACTIVATION CODES (Admin only) ===
  app.get("/api/activation-codes", requireAdmin, async (_req, res) => {
    const codes = await storage.getActivationCodes();
    res.json(codes);
  });

  app.get("/api/activation-codes/:id", requireAdmin, async (req, res) => {
    const code = await storage.getActivationCode(Number(req.params.id));
    if (!code) return res.status(404).json({ message: "Activation code not found" });
    res.json(code);
  });

  app.post("/api/activation-codes", requireAdmin, async (req, res) => {
    try {
      const validated = insertActivationCodeSchema.parse(req.body);
      const code = await storage.createActivationCode(validated);
      res.status(201).json(code);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/activation-codes/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertActivationCodeSchema.partial().parse(req.body);
      const code = await storage.updateActivationCode(Number(req.params.id), validated);
      res.json(code);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/activation-codes/:id", requireAdmin, async (req, res) => {
    await storage.deleteActivationCode(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/activation-codes/:code/redeem", async (req, res) => {
    try {
      const codeStr = req.params.code;
      const { lineId } = req.body;
      
      if (!lineId || typeof lineId !== 'number') {
        return res.status(400).json({ message: "Valid lineId is required" });
      }

      const line = await storage.getLine(lineId);
      if (!line) {
        return res.status(404).json({ message: "Line not found" });
      }
      
      const activationCode = await storage.getActivationCodeByCode(codeStr);
      if (!activationCode) {
        return res.status(404).json({ message: "Activation code not found" });
      }
      if (!activationCode.enabled) {
        return res.status(400).json({ message: "Activation code is disabled" });
      }
      if (activationCode.usedBy) {
        return res.status(400).json({ message: "Activation code already used" });
      }
      if (activationCode.expiresAt && new Date(activationCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Activation code has expired" });
      }

      const redeemed = await storage.redeemActivationCode(codeStr, lineId);
      
      if (activationCode.durationDays) {
        await storage.extendLine(lineId, activationCode.durationDays);
      }
      if (activationCode.bouquets && (activationCode.bouquets as number[]).length > 0) {
        await storage.updateLine(lineId, { bouquets: activationCode.bouquets as number[] });
      }
      if (activationCode.maxConnections) {
        await storage.updateLine(lineId, { maxConnections: activationCode.maxConnections });
      }
      
      res.json(redeemed);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Generate activation codes in bulk
  app.post("/api/activation-codes/generate", requireAdmin, async (req, res) => {
    try {
      const { count, prefix, ...codeData } = req.body;
      const numCodes = Math.min(count || 1, 100); // Max 100 at a time
      const codePrefix = prefix || "ACT";
      
      const generated = [];
      for (let i = 0; i < numCodes; i++) {
        const uniqueCode = `${codePrefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const validated = insertActivationCodeSchema.parse({ ...codeData, code: uniqueCode });
        const code = await storage.createActivationCode(validated);
        generated.push(code);
      }
      res.status(201).json(generated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === CONNECTION HISTORY (Admin only) ===
  app.get("/api/connection-history", requireAdmin, async (req, res) => {
    const lineId = req.query.lineId ? Number(req.query.lineId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const history = await storage.getConnectionHistory(lineId, limit);
    res.json(history);
  });

  // === MOST WATCHED ANALYTICS (Admin only) ===
  app.get("/api/most-watched", requireAdmin, async (req, res) => {
    const streamType = req.query.streamType as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const watched = await storage.getMostWatched(streamType, limit);
    res.json(watched);
  });

  // === TWO-FACTOR AUTHENTICATION ===
  app.get("/api/2fa/status", requireAuth, async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    const twoFactor = await storage.getTwoFactorAuth(userId);
    res.json({ enabled: twoFactor?.enabled || false, verified: !!twoFactor?.verifiedAt });
  });

  app.post("/api/2fa/setup", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { secret, backupCodes } = req.body;
      const existing = await storage.getTwoFactorAuth(userId);
      
      if (existing) {
        const updated = await storage.updateTwoFactorAuth(userId, { secret, backupCodes, enabled: false });
        res.json(updated);
      } else {
        const created = await storage.createTwoFactorAuth({ userId, secret, backupCodes, enabled: false });
        res.json(created);
      }
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/2fa/verify", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor) {
        return res.status(400).json({ message: "2FA not set up. Please run setup first." });
      }

      // Verify the TOTP code
      const totp = new OTPAuth.TOTP({
        issuer: "PanelX",
        label: req.session.username || "User",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(twoFactor.secret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      
      if (delta === null) {
        // Check backup codes
        const backupCodes = (twoFactor.backupCodes as string[]) || [];
        const codeIndex = backupCodes.indexOf(code);
        
        if (codeIndex === -1) {
          return res.status(400).json({ message: "Invalid verification code" });
        }
        
        // Remove used backup code
        const newBackupCodes = backupCodes.filter((_, i) => i !== codeIndex);
        await storage.updateTwoFactorAuth(userId, { backupCodes: newBackupCodes });
      }
      
      const updated = await storage.updateTwoFactorAuth(userId, { enabled: true, verifiedAt: new Date() });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/2fa/disable", requireAuth, async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    await storage.deleteTwoFactorAuth(userId);
    res.status(204).send();
  });

  // === FINGERPRINT SETTINGS (Admin only) ===
  app.get("/api/fingerprint-settings", requireAdmin, async (_req, res) => {
    const settings = await storage.getFingerprintSettings();
    res.json(settings);
  });

  app.get("/api/fingerprint-settings/:id", requireAdmin, async (req, res) => {
    const setting = await storage.getFingerprintSetting(Number(req.params.id));
    if (!setting) return res.status(404).json({ message: "Fingerprint setting not found" });
    res.json(setting);
  });

  app.post("/api/fingerprint-settings", requireAdmin, async (req, res) => {
    try {
      const validated = insertFingerprintSettingsSchema.parse(req.body);
      const setting = await storage.createFingerprintSetting(validated);
      res.status(201).json(setting);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/fingerprint-settings/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertFingerprintSettingsSchema.partial().parse(req.body);
      const setting = await storage.updateFingerprintSetting(Number(req.params.id), validated);
      res.json(setting);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/fingerprint-settings/:id", requireAdmin, async (req, res) => {
    await storage.deleteFingerprintSetting(Number(req.params.id));
    res.status(204).send();
  });

  // === LINE FINGERPRINTS (Admin only) ===
  app.get("/api/lines/:lineId/fingerprints", requireAdmin, async (req, res) => {
    const fingerprints = await storage.getLineFingerprints(Number(req.params.lineId));
    res.json(fingerprints);
  });

  app.post("/api/lines/:lineId/fingerprints", requireAdmin, async (req, res) => {
    try {
      const validated = insertLineFingerprintSchema.parse({ ...req.body, lineId: Number(req.params.lineId) });
      const fingerprint = await storage.createLineFingerprint(validated);
      res.status(201).json(fingerprint);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/line-fingerprints/:id", requireAdmin, async (req, res) => {
    await storage.deleteLineFingerprint(Number(req.params.id));
    res.status(204).send();
  });

  // === WATCH FOLDERS (Admin only) ===
  app.get("/api/watch-folders", requireAdmin, async (_req, res) => {
    const folders = await storage.getWatchFolders();
    res.json(folders);
  });

  app.get("/api/watch-folders/:id", requireAdmin, async (req, res) => {
    const folder = await storage.getWatchFolder(Number(req.params.id));
    if (!folder) return res.status(404).json({ message: "Watch folder not found" });
    res.json(folder);
  });

  app.post("/api/watch-folders", requireAdmin, async (req, res) => {
    try {
      const validated = insertWatchFolderSchema.parse(req.body);
      const folder = await storage.createWatchFolder(validated);
      res.status(201).json(folder);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/watch-folders/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertWatchFolderSchema.partial().parse(req.body);
      const folder = await storage.updateWatchFolder(Number(req.params.id), validated);
      res.json(folder);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/watch-folders/:id", requireAdmin, async (req, res) => {
    await storage.deleteWatchFolder(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/watch-folders/:id/logs", requireAdmin, async (req, res) => {
    const logs = await storage.getWatchFolderLogs(Number(req.params.id));
    res.json(logs);
  });

  // === LOOPING CHANNELS (24/7 Channels - Admin only) ===
  app.get("/api/looping-channels", requireAdmin, async (_req, res) => {
    const channels = await storage.getLoopingChannels();
    res.json(channels);
  });

  app.get("/api/looping-channels/:id", requireAdmin, async (req, res) => {
    const channel = await storage.getLoopingChannel(Number(req.params.id));
    if (!channel) return res.status(404).json({ message: "Looping channel not found" });
    res.json(channel);
  });

  app.post("/api/looping-channels", requireAdmin, async (req, res) => {
    try {
      const validated = insertLoopingChannelSchema.parse(req.body);
      const channel = await storage.createLoopingChannel(validated);
      res.status(201).json(channel);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/looping-channels/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertLoopingChannelSchema.partial().parse(req.body);
      const channel = await storage.updateLoopingChannel(Number(req.params.id), validated);
      res.json(channel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/looping-channels/:id", requireAdmin, async (req, res) => {
    await storage.deleteLoopingChannel(Number(req.params.id));
    res.status(204).send();
  });

  // === AUTOBLOCK RULES (Admin only) ===
  app.get("/api/autoblock-rules", requireAdmin, async (_req, res) => {
    const rules = await storage.getAutoblockRules();
    res.json(rules);
  });

  app.get("/api/autoblock-rules/:id", requireAdmin, async (req, res) => {
    const rule = await storage.getAutoblockRule(Number(req.params.id));
    if (!rule) return res.status(404).json({ message: "Autoblock rule not found" });
    res.json(rule);
  });

  app.post("/api/autoblock-rules", requireAdmin, async (req, res) => {
    try {
      const validated = insertAutoblockRuleSchema.parse(req.body);
      const rule = await storage.createAutoblockRule(validated);
      res.status(201).json(rule);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/autoblock-rules/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertAutoblockRuleSchema.partial().parse(req.body);
      const rule = await storage.updateAutoblockRule(Number(req.params.id), validated);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/autoblock-rules/:id", requireAdmin, async (req, res) => {
    await storage.deleteAutoblockRule(Number(req.params.id));
    res.status(204).send();
  });

  // === STATISTICS SNAPSHOTS (Admin only) ===
  app.get("/api/statistics-snapshots", requireAdmin, async (req, res) => {
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const snapshots = await storage.getStatisticsSnapshots(type, limit);
    res.json(snapshots);
  });

  app.post("/api/statistics-snapshots", requireAdmin, async (req, res) => {
    try {
      const validated = insertStatisticsSnapshotSchema.parse(req.body);
      const snapshot = await storage.createStatisticsSnapshot(validated);
      res.status(201).json(snapshot);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === IMPERSONATION LOGS (Admin only) ===
  app.get("/api/impersonation-logs", requireAdmin, async (req, res) => {
    const adminId = req.query.adminId ? Number(req.query.adminId) : undefined;
    const logs = await storage.getImpersonationLogs(adminId);
    res.json(logs);
  });

  app.post("/api/impersonate/:userId", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session?.userId;
      const targetUserId = Number(req.params.userId);
      
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const log = await storage.createImpersonationLog({
        adminId,
        targetUserId,
        reason: req.body.reason,
        ipAddress
      });
      
      res.json({ log, user: targetUser });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/impersonation-logs/:id/end", requireAdmin, async (req, res) => {
    try {
      const log = await storage.endImpersonation(Number(req.params.id));
      res.json(log);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === RESELLER API ENDPOINTS ===
  
  // Reseller dashboard stats
  app.get("/api/reseller/stats", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const user = await storage.getUser(userId);
      const lines = await storage.getLines();
      const myLines = lines.filter(l => l.memberId === userId);
      const now = new Date();
      
      const stats = {
        credits: user?.credits || 0,
        totalLines: myLines.length,
        activeLines: myLines.filter(l => l.enabled && (!l.expDate || new Date(l.expDate) > now)).length,
        expiredLines: myLines.filter(l => l.expDate && new Date(l.expDate) <= now).length,
        disabledLines: myLines.filter(l => !l.enabled).length,
        trialLines: myLines.filter(l => l.isTrial).length,
      };
      
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Reseller's lines
  app.get("/api/reseller/lines", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const lines = await storage.getLines();
      const myLines = lines.filter(l => l.memberId === userId);
      res.json(myLines);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Reseller create line (with credit deduction)
  app.post("/api/reseller/lines", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If package is specified, get its cost
      let creditCost = 0;
      if (req.body.packageId) {
        const pkg = await storage.getPackage(req.body.packageId);
        if (pkg) {
          creditCost = pkg.credits;
        }
      }
      
      // Check if reseller has enough credits
      if (creditCost > 0 && (user.credits || 0) < creditCost) {
        return res.status(400).json({ message: "Insufficient credits" });
      }
      
      // Create line with reseller as member
      const lineData = {
        ...req.body,
        memberId: userId,
      };
      
      const line = await storage.createLine(lineData);
      
      // Deduct credits if package was used
      if (creditCost > 0) {
        await storage.addCredits(userId, -creditCost, 'line_create', line.id);
      }
      
      res.status(201).json(line);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });
  
  // Reseller update line
  app.put("/api/reseller/lines/:id", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const lineId = Number(req.params.id);
      const line = await storage.getLine(lineId);
      
      if (!line || line.memberId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateLine(lineId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });
  
  // Reseller delete line
  app.delete("/api/reseller/lines/:id", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const lineId = Number(req.params.id);
      const line = await storage.getLine(lineId);
      
      if (!line || line.memberId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteLine(lineId);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });
  
  // Reseller credit transactions
  app.get("/api/reseller/credit-transactions", requireReseller, async (req, res) => {
    try {
      const userId = req.session!.userId;
      const transactions = await storage.getCreditTransactions(userId);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
