import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerPlayerApi } from "./playerApi";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, and, gte, desc, sql, lte, isNotNull } from "drizzle-orm";
import { 
  insertSettingSchema, insertAccessOutputSchema, insertReservedUsernameSchema,
  insertCreatedChannelSchema, insertEnigma2DeviceSchema, insertEnigma2ActionSchema, insertSignalSchema,
  insertActivationCodeSchema, insertConnectionHistorySchema, insertTwoFactorAuthSchema,
  insertFingerprintSettingsSchema, insertLineFingerprintSchema, insertWatchFolderSchema,
  insertLoopingChannelSchema, insertAutoblockRuleSchema, insertStatisticsSnapshotSchema, insertImpersonationLogSchema,
  insertCatchupSettingsSchema, insertOnDemandSettingsSchema,
  twoFactorAuth, twoFactorActivity, ipWhitelist, auditLogs, backups,
  // Batch 3 imports
  loadBalancingSettings, loadBalancingRules, serverHealthLogs, serverFailoverHistory,
  geoipSettings, geoipLogs, bandwidthStats, bandwidthAlerts, notificationHistory,
  resellerPermissions, resellerSettings, creditTransactions,
  // Batch 4 imports
  streamHealthMetrics, streamAutoRestartRules, streamErrors, epgMappings, epgData, epgSources,
  scheduledBackups, viewingAnalytics, popularContentReports,
  notificationSettings, notificationTriggers, notificationLog
} from "@shared/schema";
import * as OTPAuth from "otpauth";
import { auditLogMiddleware, logAuditEvent, logAuthFailure } from "./middleware/auditLog";
import { createBackup, restoreBackup, cleanupOldBackups, listBackups, getBackup, getBackupFile } from "./utils/backup";

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

  // === TWO-FACTOR AUTHENTICATION ===
  
  // Get 2FA status for current user
  app.get("/api/2fa", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const twoFactor = await storage.getTwoFactorAuth(userId);
      res.json(twoFactor || null);
    } catch (err) {
      console.error("Get 2FA error:", err);
      res.status(500).json({ message: "Failed to get 2FA status" });
    }
  });

  // Setup 2FA - Generate secret and QR code
  app.post("/api/2fa/setup", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate new secret and backup codes
      const secret = new OTPAuth.Secret();
      const totp = new OTPAuth.TOTP({
        issuer: "PanelX",
        label: user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });

      // Generate backup codes (10 codes, 8 characters each)
      const backupCodes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      // Create or update 2FA record (not enabled yet)
      const existing = await storage.getTwoFactorAuth(userId);
      if (existing) {
        await storage.updateTwoFactorAuth(userId, {
          secret: secret.base32,
          backupCodes,
          enabled: false,
        });
      } else {
        await storage.db.insert(twoFactorAuth).values({
          userId,
          secret: secret.base32,
          backupCodes,
          enabled: false,
        });
      }

      // Return QR code URI and backup codes
      res.json({
        qrCodeUri: totp.toString(),
        secret: secret.base32,
        backupCodes,
      });
    } catch (err) {
      console.error("Setup 2FA error:", err);
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // Verify and enable 2FA
  app.post("/api/2fa/verify", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Verification code required" });
      }

      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor) {
        return res.status(400).json({ message: "2FA not set up" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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

      const delta = totp.validate({ token: code, window: 1 });
      
      if (delta === null) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Enable 2FA
      await storage.updateTwoFactorAuth(userId, {
        enabled: true,
        verifiedAt: new Date(),
      });

      // Log activity
      await storage.db.insert(twoFactorActivity).values({
        userId,
        action: 'enable',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: "2FA enabled successfully" });
    } catch (err) {
      console.error("Verify 2FA error:", err);
      res.status(500).json({ message: "Failed to verify 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/2fa/disable", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      // Disable 2FA
      await storage.updateTwoFactorAuth(userId, {
        enabled: false,
      });

      // Log activity
      await storage.db.insert(twoFactorActivity).values({
        userId,
        action: 'disable',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: "2FA disabled successfully" });
    } catch (err) {
      console.error("Disable 2FA error:", err);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  // Regenerate backup codes
  app.post("/api/2fa/regenerate-codes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor || !twoFactor.enabled) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      // Generate new backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      await storage.updateTwoFactorAuth(userId, {
        backupCodes,
      });

      res.json({ backupCodes });
    } catch (err) {
      console.error("Regenerate backup codes error:", err);
      res.status(500).json({ message: "Failed to regenerate backup codes" });
    }
  });

  // === IP WHITELISTING ===
  
  // Get all IP whitelist rules
  app.get("/api/ip-whitelist", requireAuth, async (req, res) => {
    try {
      const rules = await db.select().from(ipWhitelist);
      res.json(rules);
    } catch (err) {
      console.error("Get IP whitelist error:", err);
      res.status(500).json({ message: "Failed to get IP whitelist" });
    }
  });

  // Add IP whitelist rule
  app.post("/api/ip-whitelist", requireAdmin, async (req, res) => {
    try {
      const { userId, ipAddress, ipRange, description, isGlobal, allowAdmin, allowReseller } = req.body;

      if (!ipAddress && !ipRange) {
        return res.status(400).json({ message: "IP address or range required" });
      }

      const [rule] = await db.insert(ipWhitelist).values({
        userId: userId || null,
        ipAddress: ipAddress || null,
        ipRange: ipRange || null,
        description: description || null,
        isActive: true,
        isGlobal: isGlobal || false,
        allowAdmin: allowAdmin !== false,
        allowReseller: allowReseller !== false,
        createdBy: req.session.userId!,
      }).returning();

      res.json(rule);
    } catch (err) {
      console.error("Add IP whitelist error:", err);
      res.status(500).json({ message: "Failed to add IP whitelist rule" });
    }
  });

  // Update IP whitelist rule
  app.put("/api/ip-whitelist/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const { ipAddress, ipRange, description, isActive, isGlobal, allowAdmin, allowReseller } = req.body;

      const [updated] = await db.update(ipWhitelist)
        .set({
          ipAddress: ipAddress || null,
          ipRange: ipRange || null,
          description: description || null,
          isActive: isActive !== undefined ? isActive : true,
          isGlobal: isGlobal !== undefined ? isGlobal : false,
          allowAdmin: allowAdmin !== undefined ? allowAdmin : true,
          allowReseller: allowReseller !== undefined ? allowReseller : true,
        })
        .where(eq(ipWhitelist.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "IP whitelist rule not found" });
      }

      res.json(updated);
    } catch (err) {
      console.error("Update IP whitelist error:", err);
      res.status(500).json({ message: "Failed to update IP whitelist rule" });
    }
  });

  // Delete IP whitelist rule
  app.delete("/api/ip-whitelist/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      
      await db.delete(ipWhitelist).where(eq(ipWhitelist.id, id));
      
      res.json({ message: "IP whitelist rule deleted" });
    } catch (err) {
      console.error("Delete IP whitelist error:", err);
      res.status(500).json({ message: "Failed to delete IP whitelist rule" });
    }
  });

  // Get current client IP
  app.get("/api/ip-whitelist/my-ip", (req, res) => {
    const clientIP = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
    res.json({ ip: clientIP });
  });

  // === AUDIT LOGS ===
  
  // Get audit logs with pagination and filters
  app.get("/api/audit-logs", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
      const action = req.query.action as string;
      const resource = req.query.resource as string;

      let query = db.select().from(auditLogs);

      if (userId) {
        query = query.where(eq(auditLogs.userId, userId)) as any;
      }
      if (action) {
        query = query.where(eq(auditLogs.action, action)) as any;
      }
      if (resource) {
        query = query.where(eq(auditLogs.resource, resource)) as any;
      }

      const logs = await query
        .orderBy(auditLogs.createdAt)
        .limit(limit)
        .offset(offset);

      res.json(logs);
    } catch (err) {
      console.error("Get audit logs error:", err);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // Get audit log by ID
  app.get("/api/audit-logs/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      
      const [log] = await db.select()
        .from(auditLogs)
        .where(eq(auditLogs.id, id));

      if (!log) {
        return res.status(404).json({ message: "Audit log not found" });
      }

      res.json(log);
    } catch (err) {
      console.error("Get audit log error:", err);
      res.status(500).json({ message: "Failed to get audit log" });
    }
  });

  // Export audit logs
  app.post("/api/audit-logs/export", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, format } = req.body;

      let query = db.select().from(auditLogs);

      if (startDate) {
        query = query.where(eq(auditLogs.createdAt, new Date(startDate))) as any;
      }

      const logs = await query.orderBy(auditLogs.createdAt);

      if (format === 'csv') {
        const csv = [
          ['ID', 'User', 'Action', 'Resource', 'IP Address', 'Timestamp'].join(','),
          ...logs.map(log => [
            log.id,
            log.username || 'N/A',
            log.action,
            log.resource,
            log.ipAddress || 'N/A',
            log.createdAt?.toISOString() || 'N/A'
          ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json(logs);
      }
    } catch (err) {
      console.error("Export audit logs error:", err);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  // Delete old audit logs (cleanup)
  app.delete("/api/audit-logs/cleanup", requireAdmin, async (req, res) => {
    try {
      const { days } = req.body;
      const daysToKeep = days || 90;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db.delete(auditLogs)
        .where(eq(auditLogs.createdAt, cutoffDate));

      res.json({ message: `Deleted audit logs older than ${daysToKeep} days` });
    } catch (err) {
      console.error("Cleanup audit logs error:", err);
      res.status(500).json({ message: "Failed to cleanup audit logs" });
    }
  });

  // ===================================
  // PHASE 2: REAL-TIME BANDWIDTH MONITORING
  // ===================================
  
  // Get real-time bandwidth overview
  app.get("/api/bandwidth/overview", requireAuth, async (req, res) => {
    try {
      const bandwidthMonitor = await import("./services/bandwidthMonitor");
      const overview = await bandwidthMonitor.getRealTimeBandwidthOverview();
      
      res.json(overview);
    } catch (error: any) {
      console.error("Failed to get bandwidth overview:", error);
      res.status(500).json({ 
        message: "Failed to get bandwidth overview",
        error: error.message 
      });
    }
  });

  // Get bandwidth statistics for a time range
  app.get("/api/bandwidth/stats", requireAuth, async (req, res) => {
    try {
      const { serverId, lineId, streamId, granularity, hours } = req.query;
      const hoursNum = Number(hours) || 24;
      const startTime = new Date(Date.now() - hoursNum * 60 * 60 * 1000);
      const endTime = new Date();

      const bandwidthMonitor = await import("./services/bandwidthMonitor");
      const stats = await bandwidthMonitor.getBandwidthStats(
        startTime,
        endTime,
        {
          serverId: serverId ? parseInt(serverId as string) : undefined,
          lineId: lineId ? parseInt(lineId as string) : undefined,
          streamId: streamId ? parseInt(streamId as string) : undefined,
          granularity: granularity as string,
        }
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get bandwidth stats:", error);
      res.status(500).json({ 
        message: "Failed to get bandwidth stats",
        error: error.message 
      });
    }
  });

  // Record bandwidth snapshot (for external monitoring agents)
  app.post("/api/bandwidth/snapshot", requireAuth, async (req, res) => {
    try {
      const bandwidthMonitor = await import("./services/bandwidthMonitor");
      await bandwidthMonitor.recordBandwidthSnapshot({
        ...req.body,
        timestamp: new Date(),
      });
      
      res.json({ message: "Bandwidth snapshot recorded successfully" });
    } catch (error: any) {
      console.error("Failed to record bandwidth snapshot:", error);
      res.status(500).json({ 
        message: "Failed to record bandwidth snapshot",
        error: error.message 
      });
    }
  });

  // Get bandwidth alerts
  app.get("/api/bandwidth/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await storage.getBandwidthAlerts();
      res.json(alerts);
    } catch (error: any) {
      console.error("Failed to get bandwidth alerts:", error);
      res.status(500).json({ 
        message: "Failed to get bandwidth alerts",
        error: error.message 
      });
    }
  });

  // Create bandwidth alert
  app.post("/api/bandwidth/alerts", requireAuth, requireAdmin, async (req, res) => {
    try {
      const alert = await storage.createBandwidthAlert(req.body);
      res.json(alert);
    } catch (error: any) {
      console.error("Failed to create bandwidth alert:", error);
      res.status(500).json({ 
        message: "Failed to create bandwidth alert",
        error: error.message 
      });
    }
  });

  // Update bandwidth alert
  app.patch("/api/bandwidth/alerts/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const alert = await storage.updateBandwidthAlert(
        parseInt(req.params.id as string),
        req.body
      );
      res.json(alert);
    } catch (error: any) {
      console.error("Failed to update bandwidth alert:", error);
      res.status(500).json({ 
        message: "Failed to update bandwidth alert",
        error: error.message 
      });
    }
  });

  // Delete bandwidth alert
  app.delete("/api/bandwidth/alerts/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteBandwidthAlert(parseInt(req.params.id as string));
      res.json({ message: "Bandwidth alert deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete bandwidth alert:", error);
      res.status(500).json({ 
        message: "Failed to delete bandwidth alert",
        error: error.message 
      });
    }
  });

  // Cleanup old bandwidth stats
  app.post("/api/bandwidth/cleanup", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { daysToKeep = 30 } = req.body;
      
      const bandwidthMonitor = await import("./services/bandwidthMonitor");
      const deletedCount = await bandwidthMonitor.cleanupOldStats(daysToKeep);
      
      res.json({ 
        message: `Deleted ${deletedCount} old bandwidth statistics`,
        deletedCount 
      });
    } catch (error: any) {
      console.error("Failed to cleanup bandwidth stats:", error);
      res.status(500).json({ 
        message: "Failed to cleanup bandwidth stats",
        error: error.message 
      });
    }
  });

  // ===================================
  // PHASE 2: GEOGRAPHIC CONNECTION MAP
  // ===================================
  
  // Get active connections with geographic data (map view)
  app.get("/api/geo/connections/map", requireAuth, async (req, res) => {
    try {
      const geoip = await import("./services/geoip");
      const connections = await geoip.getActiveConnectionsMap();
      
      res.json(connections);
    } catch (error: any) {
      console.error("Failed to get connections map:", error);
      res.status(500).json({ 
        message: "Failed to get connections map",
        error: error.message 
      });
    }
  });

  // Get connection statistics by country
  app.get("/api/geo/stats/countries", requireAuth, async (req, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      const start = startTime ? new Date(startTime as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endTime ? new Date(endTime as string) : new Date();

      const geoip = await import("./services/geoip");
      const stats = await geoip.getConnectionStatsByCountry(start, end);
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get country stats:", error);
      res.status(500).json({ 
        message: "Failed to get country stats",
        error: error.message 
      });
    }
  });

  // Get top countries by connection count
  app.get("/api/geo/top-countries", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const geoip = await import("./services/geoip");
      const topCountries = await geoip.getTopCountries(limit);
      
      res.json(topCountries);
    } catch (error: any) {
      console.error("Failed to get top countries:", error);
      res.status(500).json({ 
        message: "Failed to get top countries",
        error: error.message 
      });
    }
  });

  // Get connection heatmap data
  app.get("/api/geo/heatmap", requireAuth, async (req, res) => {
    try {
      const geoip = await import("./services/geoip");
      const heatmap = await geoip.getConnectionHeatmap();
      
      res.json(heatmap);
    } catch (error: any) {
      console.error("Failed to get connection heatmap:", error);
      res.status(500).json({ 
        message: "Failed to get connection heatmap",
        error: error.message 
      });
    }
  });

  // Lookup IP address
  app.get("/api/geo/lookup/:ip", requireAuth, async (req, res) => {
    try {
      const geoip = await import("./services/geoip");
      const geoData = await geoip.lookupIP(req.params.ip as string);
      
      if (!geoData) {
        return res.status(404).json({ message: "IP address not found or invalid" });
      }
      
      res.json(geoData);
    } catch (error: any) {
      console.error("Failed to lookup IP:", error);
      res.status(500).json({ 
        message: "Failed to lookup IP",
        error: error.message 
      });
    }
  });

  // Clean up old geo cache
  app.post("/api/geo/cleanup", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { daysToKeep = 90 } = req.body;
      
      const geoip = await import("./services/geoip");
      const deletedCount = await geoip.cleanupGeoCache(daysToKeep);
      
      res.json({ 
        message: `Deleted ${deletedCount} old geo cache entries`,
        deletedCount 
      });
    } catch (error: any) {
      console.error("Failed to cleanup geo cache:", error);
      res.status(500).json({ 
        message: "Failed to cleanup geo cache",
        error: error.message 
      });
    }
  });

  // ===================================
  // PHASE 2: MULTI-SERVER MANAGEMENT
  // ===================================
  
  // Get server health overview
  app.get("/api/servers/health", requireAuth, async (req, res) => {
    try {
      const multiServer = await import("./services/multiServer");
      const health = await multiServer.getServerHealthOverview();
      
      res.json(health);
    } catch (error: any) {
      console.error("Failed to get server health:", error);
      res.status(500).json({ 
        message: "Failed to get server health",
        error: error.message 
      });
    }
  });

  // Get server health history
  app.get("/api/servers/:id/health/history", requireAuth, async (req, res) => {
    try {
      const serverId = parseInt(req.params.id as string);
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      
      const multiServer = await import("./services/multiServer");
      const history = await multiServer.getServerHealthHistory(serverId, hours);
      
      res.json(history);
    } catch (error: any) {
      console.error("Failed to get server health history:", error);
      res.status(500).json({ 
        message: "Failed to get server health history",
        error: error.message 
      });
    }
  });

  // Record server health metrics
  app.post("/api/servers/:id/health", requireAuth, async (req, res) => {
    try {
      const serverId = parseInt(req.params.id as string);
      
      const multiServer = await import("./services/multiServer");
      await multiServer.recordServerHealth(serverId, req.body);
      
      res.json({ message: "Server health recorded successfully" });
    } catch (error: any) {
      console.error("Failed to record server health:", error);
      res.status(500).json({ 
        message: "Failed to record server health",
        error: error.message 
      });
    }
  });

  // Select best server (load balancing)
  app.get("/api/servers/select", requireAuth, async (req, res) => {
    try {
      const { strategy, country, latitude, longitude, streamId } = req.query;
      
      const multiServer = await import("./services/multiServer");
      const serverId = await multiServer.selectServer(
        (strategy as any) || 'least_connections',
        {
          geoLocation: country || latitude || longitude ? {
            country: country as string,
            latitude: latitude ? parseFloat(latitude as string) : undefined,
            longitude: longitude ? parseFloat(longitude as string) : undefined,
          } : undefined,
          streamId: streamId ? parseInt(streamId as string) : undefined,
        }
      );
      
      if (!serverId) {
        return res.status(503).json({ message: "No healthy servers available" });
      }
      
      res.json({ serverId });
    } catch (error: any) {
      console.error("Failed to select server:", error);
      res.status(500).json({ 
        message: "Failed to select server",
        error: error.message 
      });
    }
  });

  // Trigger manual failover
  app.post("/api/servers/failover", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { fromServerId, toServerId, reason } = req.body;
      const userId = req.session.userId!;
      
      if (!fromServerId || !toServerId) {
        return res.status(400).json({ message: "fromServerId and toServerId are required" });
      }
      
      const multiServer = await import("./services/multiServer");
      await multiServer.triggerFailover(fromServerId, toServerId, reason || "Manual failover", userId);
      
      res.json({ message: "Failover triggered successfully" });
    } catch (error: any) {
      console.error("Failed to trigger failover:", error);
      res.status(500).json({ 
        message: "Failed to trigger failover",
        error: error.message 
      });
    }
  });

  // Get server statistics
  app.get("/api/servers/statistics", requireAuth, async (req, res) => {
    try {
      const multiServer = await import("./services/multiServer");
      const stats = await multiServer.getServerStatistics();
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get server statistics:", error);
      res.status(500).json({ 
        message: "Failed to get server statistics",
        error: error.message 
      });
    }
  });

  // Create server sync job
  app.post("/api/servers/sync", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { jobType, sourceServerId, targetServerId } = req.body;
      
      if (!jobType || !targetServerId) {
        return res.status(400).json({ message: "jobType and targetServerId are required" });
      }
      
      const multiServer = await import("./services/multiServer");
      const jobId = await multiServer.createSyncJob(jobType, sourceServerId, targetServerId);
      
      res.json({ jobId, message: "Sync job created successfully" });
    } catch (error: any) {
      console.error("Failed to create sync job:", error);
      res.status(500).json({ 
        message: "Failed to create sync job",
        error: error.message 
      });
    }
  });

  // Get load balancing rules
  app.get("/api/servers/load-balancing/rules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const multiServer = await import("./services/multiServer");
      const rules = await multiServer.getLoadBalancingRules();
      
      res.json(rules);
    } catch (error: any) {
      console.error("Failed to get load balancing rules:", error);
      res.status(500).json({ 
        message: "Failed to get load balancing rules",
        error: error.message 
      });
    }
  });

  // ===================================
  // PHASE 2: TMDB INTEGRATION
  // ===================================
  
  // Search TMDB
  app.get("/api/tmdb/search", requireAuth, async (req, res) => {
    try {
      const { query, mediaType, year } = req.query;
      
      if (!query || !mediaType) {
        return res.status(400).json({ message: "query and mediaType are required" });
      }
      
      const tmdb = await import("./services/tmdb");
      const results = await tmdb.searchTMDB(
        query as string,
        mediaType as 'movie' | 'tv',
        year as string | undefined
      );
      
      res.json(results);
    } catch (error: any) {
      console.error("TMDB search failed:", error);
      res.status(500).json({ 
        message: "TMDB search failed",
        error: error.message 
      });
    }
  });

  // Get TMDB details
  app.get("/api/tmdb/:tmdbId", requireAuth, async (req, res) => {
    try {
      const tmdbId = parseInt(req.params.tmdbId as string);
      const { mediaType } = req.query;
      
      if (!mediaType) {
        return res.status(400).json({ message: "mediaType is required" });
      }
      
      const tmdb = await import("./services/tmdb");
      
      // Check cache first
      let metadata = await tmdb.getCachedMetadata(tmdbId);
      
      if (!metadata) {
        // Fetch from TMDB API
        const details = await tmdb.getTMDBDetails(tmdbId, mediaType as 'movie' | 'tv');
        if (details) {
          await tmdb.cacheTMDBMetadata(tmdbId, mediaType as 'movie' | 'tv', details);
          metadata = await tmdb.getCachedMetadata(tmdbId);
        }
      }
      
      if (!metadata) {
        return res.status(404).json({ message: "TMDB metadata not found" });
      }
      
      res.json(metadata);
    } catch (error: any) {
      console.error("Failed to get TMDB details:", error);
      res.status(500).json({ 
        message: "Failed to get TMDB details",
        error: error.message 
      });
    }
  });

  // Add to sync queue
  app.post("/api/tmdb/sync/queue", requireAuth, async (req, res) => {
    try {
      const { mediaType, referenceId, referenceType, searchTitle, searchYear, priority } = req.body;
      
      if (!mediaType || !referenceId || !referenceType || !searchTitle) {
        return res.status(400).json({ 
          message: "mediaType, referenceId, referenceType, and searchTitle are required" 
        });
      }
      
      const tmdb = await import("./services/tmdb");
      const queueId = await tmdb.addToSyncQueue(
        mediaType,
        referenceId,
        referenceType,
        searchTitle,
        searchYear,
        priority
      );
      
      res.json({ queueId, message: "Added to sync queue" });
    } catch (error: any) {
      console.error("Failed to add to sync queue:", error);
      res.status(500).json({ 
        message: "Failed to add to sync queue",
        error: error.message 
      });
    }
  });

  // Process sync queue
  app.post("/api/tmdb/sync/process", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { batchSize = 10 } = req.body;
      
      const tmdb = await import("./services/tmdb");
      const result = await tmdb.processSyncQueue(batchSize);
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to process sync queue:", error);
      res.status(500).json({ 
        message: "Failed to process sync queue",
        error: error.message 
      });
    }
  });

  // Get sync queue stats
  app.get("/api/tmdb/sync/stats", requireAuth, async (req, res) => {
    try {
      const tmdb = await import("./services/tmdb");
      const stats = await tmdb.getSyncQueueStats();
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get sync queue stats:", error);
      res.status(500).json({ 
        message: "Failed to get sync queue stats",
        error: error.message 
      });
    }
  });

  // Batch sync series
  app.post("/api/tmdb/sync/series/batch", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tmdb = await import("./services/tmdb");
      const storage = await import("./storage");
      
      // Get all series without TMDB ID
      const allSeries = await storage.storage.getSeries();
      const missingTMDB = allSeries.filter((s: { id: number; name: string; tmdbId?: string | null; releaseDate?: string | null }) => !s.tmdbId);
      
      // Add to queue
      let added = 0;
      for (const s of missingTMDB) {
        try {
          await tmdb.addToSyncQueue(
            'tv',
            s.id,
            'series',
            s.name,
            s.releaseDate?.split('-')[0],
            0
          );
          added++;
        } catch (error) {
          console.error(`Failed to queue series ${s.id}:`, error);
        }
      }
      
      res.json({ 
        message: `Added ${added} series to sync queue`,
        total: missingTMDB.length,
        added 
      });
    } catch (error: any) {
      console.error("Failed to batch sync series:", error);
      res.status(500).json({ 
        message: "Failed to batch sync series",
        error: error.message 
      });
    }
  });

  // ===================================
  // PHASE 2: SUBTITLE SYSTEM
  // ===================================
  
  // Get subtitles for content
  app.get("/api/subtitles", requireAuth, async (req, res) => {
    try {
      const { referenceType, referenceId, language } = req.query;
      
      if (!referenceType || !referenceId) {
        return res.status(400).json({ message: "referenceType and referenceId are required" });
      }
      
      const subtitle = await import("./services/subtitle");
      const subtitles = await subtitle.getSubtitles(
        referenceType as string,
        parseInt(referenceId as string),
        language as string | undefined
      );
      
      res.json(subtitles);
    } catch (error: any) {
      console.error("Failed to get subtitles:", error);
      res.status(500).json({ 
        message: "Failed to get subtitles",
        error: error.message 
      });
    }
  });

  // Upload subtitle
  app.post("/api/subtitles", requireAuth, async (req, res) => {
    try {
      const subtitle = await import("./services/subtitle");
      const userId = req.session.userId!;
      
      const subtitleId = await subtitle.uploadSubtitle({
        ...req.body,
        userId,
      });
      
      res.json({ subtitleId, message: "Subtitle uploaded successfully" });
    } catch (error: any) {
      console.error("Failed to upload subtitle:", error);
      res.status(500).json({ 
        message: "Failed to upload subtitle",
        error: error.message 
      });
    }
  });

  // Download subtitle
  app.get("/api/subtitles/:id/download", requireAuth, async (req, res) => {
    try {
      const subtitleId = parseInt(req.params.id as string);
      const userId = req.session.userId!;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');
      
      const subtitle = await import("./services/subtitle");
      const result = await subtitle.downloadSubtitle(subtitleId, userId, ipAddress, userAgent);
      
      if (!result) {
        return res.status(404).json({ message: "Subtitle not found" });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', `text/${result.format}`);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.content);
    } catch (error: any) {
      console.error("Failed to download subtitle:", error);
      res.status(500).json({ 
        message: "Failed to download subtitle",
        error: error.message 
      });
    }
  });

  // Update subtitle
  app.patch("/api/subtitles/:id", requireAuth, async (req, res) => {
    try {
      const subtitleId = parseInt(req.params.id as string);
      
      const subtitle = await import("./services/subtitle");
      await subtitle.updateSubtitle(subtitleId, req.body);
      
      res.json({ message: "Subtitle updated successfully" });
    } catch (error: any) {
      console.error("Failed to update subtitle:", error);
      res.status(500).json({ 
        message: "Failed to update subtitle",
        error: error.message 
      });
    }
  });

  // Delete subtitle
  app.delete("/api/subtitles/:id", requireAuth, async (req, res) => {
    try {
      const subtitleId = parseInt(req.params.id as string);
      
      const subtitle = await import("./services/subtitle");
      await subtitle.deleteSubtitle(subtitleId);
      
      res.json({ message: "Subtitle deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete subtitle:", error);
      res.status(500).json({ 
        message: "Failed to delete subtitle",
        error: error.message 
      });
    }
  });

  // Get subtitle statistics
  app.get("/api/subtitles/stats", requireAuth, async (req, res) => {
    try {
      const subtitle = await import("./services/subtitle");
      const stats = await subtitle.getSubtitleStats();
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get subtitle stats:", error);
      res.status(500).json({ 
        message: "Failed to get subtitle stats",
        error: error.message 
      });
    }
  });

  // Get popular languages
  app.get("/api/subtitles/languages/popular", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const subtitle = await import("./services/subtitle");
      const languages = await subtitle.getPopularLanguages(limit);
      
      res.json(languages);
    } catch (error: any) {
      console.error("Failed to get popular languages:", error);
      res.status(500).json({ 
        message: "Failed to get popular languages",
        error: error.message 
      });
    }
  });

  // Search subtitles
  app.get("/api/subtitles/search", requireAuth, async (req, res) => {
    try {
      const subtitle = await import("./services/subtitle");
      const results = await subtitle.searchSubtitles({
        language: req.query.language as string | undefined,
        referenceType: req.query.referenceType as string | undefined,
        verified: req.query.verified === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      });
      
      res.json(results);
    } catch (error: any) {
      console.error("Failed to search subtitles:", error);
      res.status(500).json({ 
        message: "Failed to search subtitles",
        error: error.message 
      });
    }
  });

  // Batch import subtitles
  app.post("/api/subtitles/batch-import", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { directoryPath, referenceType, referenceId } = req.body;
      const userId = req.session.userId!;
      
      if (!directoryPath || !referenceType || !referenceId) {
        return res.status(400).json({ 
          message: "directoryPath, referenceType, and referenceId are required" 
        });
      }
      
      const subtitle = await import("./services/subtitle");
      const result = await subtitle.batchImportSubtitles(
        directoryPath,
        referenceType,
        referenceId,
        userId
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to batch import subtitles:", error);
      res.status(500).json({ 
        message: "Failed to batch import subtitles",
        error: error.message 
      });
    }
  });

  // ===================================
  // PHASE 3: BUSINESS FEATURES
  // ===================================
  
  // ========== INVOICES ==========
  
  // Create invoice
  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoice = await import("./services/invoice");
      const userId = req.session.userId!;
      
      const invoiceId = await invoice.createInvoice({
        userId,
        ...req.body,
      });
      
      res.json({ invoiceId, message: "Invoice created successfully" });
    } catch (error: any) {
      console.error("Failed to create invoice:", error);
      res.status(500).json({ message: "Failed to create invoice", error: error.message });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id as string);
      
      const invoice = await import("./services/invoice");
      const result = await invoice.getInvoice(invoiceId);
      
      if (!result) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to get invoice:", error);
      res.status(500).json({ message: "Failed to get invoice", error: error.message });
    }
  });

  // Get user invoices
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { status } = req.query;
      
      const invoice = await import("./services/invoice");
      const invoices = await invoice.getUserInvoices(userId, status as string);
      
      res.json(invoices);
    } catch (error: any) {
      console.error("Failed to get invoices:", error);
      res.status(500).json({ message: "Failed to get invoices", error: error.message });
    }
  });

  // Mark invoice as paid
  app.post("/api/invoices/:id/pay", requireAuth, requireAdmin, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id as string);
      
      const invoice = await import("./services/invoice");
      await invoice.markInvoicePaid(invoiceId, req.body);
      
      res.json({ message: "Invoice marked as paid" });
    } catch (error: any) {
      console.error("Failed to mark invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid", error: error.message });
    }
  });

  // Cancel invoice
  app.post("/api/invoices/:id/cancel", requireAuth, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id as string);
      
      const invoice = await import("./services/invoice");
      await invoice.cancelInvoice(invoiceId);
      
      res.json({ message: "Invoice cancelled" });
    } catch (error: any) {
      console.error("Failed to cancel invoice:", error);
      res.status(500).json({ message: "Failed to cancel invoice", error: error.message });
    }
  });

  // Get invoice statistics
  app.get("/api/invoices/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const invoice = await import("./services/invoice");
      const stats = await invoice.getInvoiceStatistics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get invoice statistics:", error);
      res.status(500).json({ message: "Failed to get invoice statistics", error: error.message });
    }
  });

  // ========== API KEYS ==========
  
  // Create API key
  app.post("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { keyName, permissions, ipWhitelist, rateLimit, expiresAt } = req.body;
      
      const apiKey = await import("./services/apiKey");
      const result = await apiKey.createApiKey(userId, keyName, {
        permissions,
        ipWhitelist,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to create API key:", error);
      res.status(500).json({ message: "Failed to create API key", error: error.message });
    }
  });

  // Get user API keys
  app.get("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const apiKey = await import("./services/apiKey");
      const keys = await apiKey.getUserApiKeys(userId);
      
      // Don't expose keySecret in list
      const sanitized = keys.map(k => ({
        ...k,
        keySecret: '***hidden***',
      }));
      
      res.json(sanitized);
    } catch (error: any) {
      console.error("Failed to get API keys:", error);
      res.status(500).json({ message: "Failed to get API keys", error: error.message });
    }
  });

  // Revoke API key
  app.post("/api/api-keys/:id/revoke", requireAuth, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id as string);
      
      const apiKey = await import("./services/apiKey");
      await apiKey.revokeApiKey(keyId);
      
      res.json({ message: "API key revoked" });
    } catch (error: any) {
      console.error("Failed to revoke API key:", error);
      res.status(500).json({ message: "Failed to revoke API key", error: error.message });
    }
  });

  // Delete API key
  app.delete("/api/api-keys/:id", requireAuth, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id as string);
      
      const apiKey = await import("./services/apiKey");
      await apiKey.deleteApiKey(keyId);
      
      res.json({ message: "API key deleted" });
    } catch (error: any) {
      console.error("Failed to delete API key:", error);
      res.status(500).json({ message: "Failed to delete API key", error: error.message });
    }
  });

  // Get API key usage statistics
  app.get("/api/api-keys/:id/stats", requireAuth, async (req, res) => {
    try {
      const keyId = parseInt(req.params.id as string);
      const { startDate, endDate } = req.query;
      
      const apiKey = await import("./services/apiKey");
      const stats = await apiKey.getApiKeyUsageStats(
        keyId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get API key stats:", error);
      res.status(500).json({ message: "Failed to get API key stats", error: error.message });
    }
  });

  // ========== COMMISSIONS ==========
  
  // Create commission rule
  app.post("/api/commissions/rules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const commission = await import("./services/commission");
      const ruleId = await commission.createCommissionRule(req.body);
      
      res.json({ ruleId, message: "Commission rule created" });
    } catch (error: any) {
      console.error("Failed to create commission rule:", error);
      res.status(500).json({ message: "Failed to create commission rule", error: error.message });
    }
  });

  // Calculate reseller commissions
  app.get("/api/commissions/calculate/:resellerId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const resellerId = parseInt(req.params.resellerId as string);
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const commission = await import("./services/commission");
      const result = await commission.calculateResellerCommissions(
        resellerId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to calculate commissions:", error);
      res.status(500).json({ message: "Failed to calculate commissions", error: error.message });
    }
  });

  // Create commission payment
  app.post("/api/commissions/payments", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { resellerId, startDate, endDate } = req.body;
      
      if (!resellerId || !startDate || !endDate) {
        return res.status(400).json({ message: "resellerId, startDate, and endDate are required" });
      }
      
      const commission = await import("./services/commission");
      const paymentId = await commission.createCommissionPayment(
        resellerId,
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json({ paymentId, message: "Commission payment created" });
    } catch (error: any) {
      console.error("Failed to create commission payment:", error);
      res.status(500).json({ message: "Failed to create commission payment", error: error.message });
    }
  });

  // Mark commission as paid
  app.post("/api/commissions/payments/:id/pay", requireAuth, requireAdmin, async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id as string);
      
      const commission = await import("./services/commission");
      await commission.markCommissionPaid(paymentId, req.body);
      
      res.json({ message: "Commission marked as paid" });
    } catch (error: any) {
      console.error("Failed to mark commission as paid:", error);
      res.status(500).json({ message: "Failed to mark commission as paid", error: error.message });
    }
  });

  // Get reseller commission payments
  app.get("/api/commissions/payments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { status } = req.query;
      
      const commission = await import("./services/commission");
      const payments = await commission.getResellerCommissionPayments(userId, status as string);
      
      res.json(payments);
    } catch (error: any) {
      console.error("Failed to get commission payments:", error);
      res.status(500).json({ message: "Failed to get commission payments", error: error.message });
    }
  });

  // Get commission statistics
  app.get("/api/commissions/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { resellerId, startDate, endDate } = req.query;
      
      const commission = await import("./services/commission");
      const stats = await commission.getCommissionStatistics(
        resellerId ? parseInt(resellerId as string) : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get commission statistics:", error);
      res.status(500).json({ message: "Failed to get commission statistics", error: error.message });
    }
  });

  //   // === PHASE 4: ADVANCED FEATURES ===
  // 
  //   // ===== RECOMMENDATION ENGINE =====
  //   
  //   // Get personalized recommendations for user
  //   app.get('/api/recommendations/:userId', async (c) => {
  //     const userId = parseInt(c.req.param('userId'));
  //     const type = c.req.query('type') || 'all'; // 'all', 'movies', 'series', 'live'
  //     const limit = parseInt(c.req.query('limit') || '20');
  // 
  //     // Import recommendation service dynamically
  //     const { getPersonalizedRecommendations } = await import('./services/recommendation');
  //     
  //     const recommendations = await getPersonalizedRecommendations(userId, {
  //       type: type as any,
  //       limit
  //     });
  // 
  //     return c.json({ recommendations });
  //   });
  // 
  //   // Get similar content
  //   app.get('/api/recommendations/similar/:contentId', async (c) => {
  //     const contentId = parseInt(c.req.param('contentId'));
  //     const contentType = c.req.query('type') || 'vod'; // 'vod', 'series', 'episode'
  //     const limit = parseInt(c.req.query('limit') || '10');
  // 
  //     const { getSimilarContent } = await import('./services/recommendation');
  //     
  //     const similar = await getSimilarContent(contentId, contentType as any, limit);
  // 
  //     return c.json({ similar });
  //   });
  // 
  //   // Get trending content
  //   app.get('/api/recommendations/trending', async (c) => {
  //     const period = c.req.query('period') || '7d'; // '24h', '7d', '30d'
  //     const type = c.req.query('type') || 'all';
  //     const limit = parseInt(c.req.query('limit') || '20');
  // 
  //     const { getTrendingContent } = await import('./services/recommendation');
  //     
  //     const trending = await getTrendingContent({ period: period as any, type: type as any, limit });
  // 
  //     return c.json({ trending });
  //   });
  // 
  //   // Update user preferences
  //   app.post('/api/recommendations/preferences/:userId', async (c) => {
  //     const userId = parseInt(c.req.param('userId'));
  //     const { categories, languages, preferredQuality } = await c.req.json();
  // 
  //     const { updateUserPreferences } = await import('./services/recommendation');
  //     
  //     await updateUserPreferences(userId, { categories, languages, preferredQuality });
  // 
  //     return c.json({ success: true });
  //   });
  // 
  //   // ===== ML ANALYTICS =====
  // 
  //   // Get user analytics dashboard
  //   app.get('/api/analytics/dashboard', async (c) => {
  //     const period = c.req.query('period') || '30d';
  // 
  //     const { getAnalyticsDashboard } = await import('./services/analytics');
  //     
  //     const dashboard = await getAnalyticsDashboard(period);
  // 
  //     return c.json(dashboard);
  //   });
  // 
  //   // Predict user churn
  //   app.get('/api/analytics/churn/:userId', async (c) => {
  //     const userId = parseInt(c.req.param('userId'));
  // 
  //     const { predictChurn } = await import('./services/analytics');
  //     
  //     const prediction = await predictChurn(userId);
  // 
  //     return c.json(prediction);
  //   });
  // 
  //   // Get content performance analytics
  //   app.get('/api/analytics/content/:contentId', async (c) => {
  //     const contentId = parseInt(c.req.param('contentId'));
  //     const contentType = c.req.query('type') || 'vod';
  // 
  //     const { getContentPerformance } = await import('./services/analytics');
  //     
  //     const performance = await getContentPerformance(contentId, contentType as any);
  // 
  //     return c.json(performance);
  //   });
  // 
  //   // Get user segmentation
  //   app.get('/api/analytics/segments', async (c) => {
  //     const { getUserSegments } = await import('./services/analytics');
  //     
  //     const segments = await getUserSegments();
  // 
  //     return c.json({ segments });
  //   });
  // 
  //   // ===== CDN INTEGRATION =====
  // 
  //   // List CDN providers
  //   app.get('/api/cdn/providers', async (c) => {
  //     const { listCdnProviders } = await import('./services/cdn');
  //     
  //     const providers = await listCdnProviders();
  // 
  //     return c.json({ providers });
  //   });
  // 
  //   // Create CDN provider
  //   app.post('/api/cdn/providers', async (c) => {
  //     const data = await c.req.json();
  // 
  //     const { createCdnProvider } = await import('./services/cdn');
  //     
  //     const provider = await createCdnProvider(data);
  // 
  //     return c.json(provider);
  //   });
  // 
  //   // Update CDN provider
  //   app.patch('/api/cdn/providers/:id', async (c) => {
  //     const id = parseInt(c.req.param('id'));
  //     const data = await c.req.json();
  // 
  //     const { updateCdnProvider } = await import('./services/cdn');
  //     
  //     const provider = await updateCdnProvider(id, data);
  // 
  //     return c.json(provider);
  //   });
  // 
  //   // Delete CDN provider
  //   app.delete('/api/cdn/providers/:id', async (c) => {
  //     const id = parseInt(c.req.param('id'));
  // 
  //     const { deleteCdnProvider } = await import('./services/cdn');
  //     
  //     await deleteCdnProvider(id);
  // 
  //     return c.json({ success: true });
  //   });
  // 
  //   // Get CDN analytics
  //   app.get('/api/cdn/analytics', async (c) => {
  //     const startDate = new Date(c.req.query('startDate') || Date.now() - 30 * 24 * 60 * 60 * 1000);
  //     const endDate = new Date(c.req.query('endDate') || Date.now());
  // 
  //     const { getCdnAnalytics } = await import('./services/cdn');
  //     
  //     const analytics = await getCdnAnalytics(startDate, endDate);
  // 
  //     return c.json({ analytics });
  //   });
  // 
  //   // Get cost optimization report
  //   app.get('/api/cdn/cost-optimization', async (c) => {
  //     const period = c.req.query('period') || new Date().toISOString().substring(0, 7);
  // 
  //     const { getCostOptimizationReport } = await import('./services/cdn');
  //     
  //     const report = await getCostOptimizationReport(period);
  // 
  //     return c.json(report);
  //   });
  // 
  //   // Track CDN usage
  //   app.post('/api/cdn/track', async (c) => {
  //     const data = await c.req.json();
  // 
  //     const { trackCdnUsage } = await import('./services/cdn');
  //     
  //     await trackCdnUsage(data);
  // 
  //     return c.json({ success: true });
  //   });
  // 
  //   // Purge CDN cache
  //   app.post('/api/cdn/purge/:providerId', async (c) => {
  //     const providerId = parseInt(c.req.param('providerId'));
  //     const { paths } = await c.req.json();
  // 
  //     const { purgeCdnCache } = await import('./services/cdn');
  //     
  //     const success = await purgeCdnCache(providerId, paths);
  // 
  //     return c.json({ success });
  //   });
  // 
  //   // ===== ADVANCED EPG =====
  // 
  //   // Search EPG programs
  //   app.get('/api/epg/search', async (c) => {
  //     const query = c.req.query('q');
  //     const channelId = c.req.query('channelId');
  //     const category = c.req.query('category');
  //     const limit = parseInt(c.req.query('limit') || '50');
  //     const offset = parseInt(c.req.query('offset') || '0');
  // 
  //     const { searchEpgPrograms } = await import('./services/epg');
  //     
  //     const programs = await searchEpgPrograms({
  //       query,
  //       channelId: channelId ? parseInt(channelId) : undefined,
  //       category
  //     }, limit, offset);
  // 
  //     return c.json({ programs, count: programs.length });
  //   });
  // 
  //   // Get channel schedule
  //   app.get('/api/epg/channel/:channelId', async (c) => {
  //     const channelId = parseInt(c.req.param('channelId'));
  //     const hours = parseInt(c.req.query('hours') || '24');
  // 
  //     const { getChannelSchedule } = await import('./services/epg');
  //     
  //     const schedule = await getChannelSchedule(channelId, hours);
  // 
  //     return c.json({ schedule });
  //   });
  // 
  //   // Create program reminder
  //   app.post('/api/epg/reminders', async (c) => {
  //     const data = await c.req.json();
  // 
  //     const { createReminder } = await import('./services/epg');
  //     
  //     const reminder = await createReminder(data);
  // 
  //     return c.json(reminder);
  //   });
  // 
  //   // Get user reminders
  //   app.get('/api/epg/reminders/:userId', async (c) => {
  //     const userId = parseInt(c.req.param('userId'));
  //     const includeExpired = c.req.query('includeExpired') === 'true';
  // 
  //     const { getUserReminders } = await import('./services/epg');
  //     
  //     const reminders = await getUserReminders(userId, includeExpired);
  // 
  //     return c.json({ reminders });
  //   });
  // 
  //   // Schedule recording
  //   app.post('/api/epg/recordings', async (c) => {
  //     const data = await c.req.json();
  // 
  //     const { scheduleRecording } = await import('./services/epg');
  //     
  //     const recording = await scheduleRecording(data);
  // 
  //     return c.json(recording);
  //   });
  // 
  //   // Get user recordings
  //   app.get('/api/epg/recordings/:userId', async (c) => {
  //     const userId = parseInt(c.req.param('userId'));
  //     const status = c.req.query('status');
  // 
  //     const { getUserRecordings } = await import('./services/epg');
  //     
  //     const recordings = await getUserRecordings(userId, status);
  // 
  //     return c.json({ recordings });
  //   });
  // 
  //   // Update recording status
  //   app.patch('/api/epg/recordings/:id', async (c) => {
  //     const id = parseInt(c.req.param('id'));
  //     const { status, fileUrl } = await c.req.json();
  // 
  //     const { updateRecordingStatus } = await import('./services/epg');
  //     
  //     const recording = await updateRecordingStatus(id, status, fileUrl);
  // 
  //     return c.json(recording);
  //   });
  // 
  //   // Get catch-up content
  //   app.get('/api/epg/catchup/:channelId', async (c) => {
  //     const channelId = parseInt(c.req.param('channelId'));
  //     const days = parseInt(c.req.query('days') || '7');
  // 
  //     const { getChannelCatchup } = await import('./services/epg');
  //     
  //     const catchup = await getChannelCatchup(channelId, days);
  // 
  //     return c.json({ catchup });
  //   });
  // 
  //   // Track catch-up view
  //   app.post('/api/epg/catchup/:id/view', async (c) => {
  //     const id = parseInt(c.req.param('id'));
  // 
  //     const { trackCatchupView } = await import('./services/epg');
  //     
  //     await trackCatchupView(id);
  // 
  //     return c.json({ success: true });
  //   });
  // 
  // === BACKUP & RESTORE ===
  
  // Get all backups
  app.get("/api/backups", requireAdmin, async (req, res) => {
    try {
      const allBackups = await listBackups();
      res.json(allBackups);
    } catch (err) {
      console.error("Get backups error:", err);
      res.status(500).json({ message: "Failed to get backups" });
    }
  });

  // Create new backup
  app.post("/api/backups/create", requireAdmin, async (req, res) => {
    try {
      const { type, includedTables } = req.body;
      
      if (!['full', 'database', 'settings'].includes(type)) {
        return res.status(400).json({ message: "Invalid backup type" });
      }

      const result = await createBackup({
        type,
        createdBy: req.session.userId!,
        includedTables: includedTables || [],
      });

      res.json(result);
    } catch (err) {
      console.error("Create backup error:", err);
      res.status(500).json({ message: `Failed to create backup: ${(err as Error).message}` });
    }
  });

  // Get backup by ID
  app.get("/api/backups/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const backup = await getBackup(id);
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json(backup);
    } catch (err) {
      console.error("Get backup error:", err);
      res.status(500).json({ message: "Failed to get backup" });
    }
  });

  // Download backup file
  app.get("/api/backups/:id/download", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const backup = await getBackup(id);
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      if (!backup.filePath) {
        return res.status(404).json({ message: "Backup file not found" });
      }

      const fileBuffer = getBackupFile(backup.filePath);
      
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.backupName}.sql"`);
      res.send(fileBuffer);
    } catch (err) {
      console.error("Download backup error:", err);
      res.status(500).json({ message: "Failed to download backup" });
    }
  });

  // Restore from backup
  app.post("/api/backups/:id/restore", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      
      // Log this critical action
      await logAuditEvent(
        req.session.userId!,
        req.session.username!,
        'RESTORE_BACKUP',
        'backup',
        id,
        { backupId: id },
        req,
        res
      );

      await restoreBackup(id);
      
      res.json({ message: "Backup restored successfully" });
    } catch (err) {
      console.error("Restore backup error:", err);
      res.status(500).json({ message: `Failed to restore backup: ${(err as Error).message}` });
    }
  });

  // Delete backup
  app.delete("/api/backups/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const backup = await getBackup(id);
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      // Delete file if exists
      if (backup.filePath && require('fs').existsSync(backup.filePath)) {
        require('fs').unlinkSync(backup.filePath);
      }

      // Delete record
      await db.delete(backups).where(eq(backups.id, id));
      
      res.json({ message: "Backup deleted successfully" });
    } catch (err) {
      console.error("Delete backup error:", err);
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  // Cleanup old backups
  app.post("/api/backups/cleanup", requireAdmin, async (req, res) => {
    try {
      const { daysToKeep } = req.body;
      const days = daysToKeep || 30;
      
      const deletedCount = await cleanupOldBackups(days);
      
      res.json({ message: `Deleted ${deletedCount} old backups`, deletedCount });
    } catch (err) {
      console.error("Cleanup backups error:", err);
      res.status(500).json({ message: "Failed to cleanup backups" });
    }
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
      // Convert expDate string to Date object if provided
      const bodyData = { ...req.body };
      if (bodyData.expDate && typeof bodyData.expDate === 'string') {
        bodyData.expDate = new Date(bodyData.expDate);
      }
      const input = api.lines.create.input.parse({
        ...bodyData,
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

  app.post(api.users.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.users.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.users.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.status(204).send();
  });

  app.post(api.users.addCredits.path, requireAdmin, async (req, res) => {
    try {
      const { amount, reason } = api.users.addCredits.input.parse(req.body);
      const user = await storage.addCredits(Number(req.params.id), amount, reason || 'admin_add');
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  // === CATEGORIES ===
  app.get(api.categories.list.path, async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.post(api.categories.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const category = await storage.createCategory(input);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.categories.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.categories.update.input.parse(req.body);
      const category = await storage.updateCategory(Number(req.params.id), input);
      res.json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.categories.delete.path, requireAuth, async (req, res) => {
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

  app.post(api.streams.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.streams.create.input.parse(req.body);
      const stream = await storage.createStream(input);
      res.status(201).json(stream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.streams.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.streams.update.input.parse(req.body);
      const stream = await storage.updateStream(Number(req.params.id), input);
      res.json(stream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.streams.delete.path, requireAuth, async (req, res) => {
    try {
      await storage.deleteStream(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete stream" });
    }
  });

  // Bulk edit streams
  app.post("/api/streams/bulk-edit", requireAdmin, async (req, res) => {
    try {
      const { streamIds, updates } = req.body;
      
      if (!streamIds || !Array.isArray(streamIds) || streamIds.length === 0) {
        return res.status(400).json({ message: "streamIds array is required" });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: "updates object is required" });
      }
      
      // Update each stream
      for (const streamId of streamIds) {
        await storage.updateStream(streamId, updates as any);
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${streamIds.length} streams`,
        updatedCount: streamIds.length 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to bulk edit streams" });
    }
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

  // M3U Import endpoint
  app.post("/api/bulk/import/m3u", requireAuth, async (req, res) => {
    try {
      const { content, categoryId, streamType = "live" } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "M3U content is required" });
      }
      
      const imported: any[] = [];
      const lines = content.split('\n');
      let currentStream: any = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Parse EXTINF line
        if (line.startsWith('#EXTINF:')) {
          const nameMatch = line.match(/,(.+)$/);
          const name = nameMatch ? nameMatch[1].trim() : `Stream ${i}`;
          
          currentStream = {
            name,
            streamType,
            categoryId: categoryId || null,
            isMonitored: true,
            monitorStatus: 'unknown' as const
          };
        }
        // Parse URL line
        else if (line && !line.startsWith('#') && currentStream) {
          currentStream.sourceUrl = line;
          
          // Create stream
          const created = await storage.createStream(currentStream);
          imported.push(created);
          currentStream = null;
        }
      }
      
      res.json({ 
        imported: imported.length, 
        streams: imported 
      });
    } catch (error: any) {
      console.error('[API] M3U import error:', error);
      res.status(500).json({ message: error.message || "Failed to import M3U" });
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

  // ==========================================
  // TRANSCODE PROFILES ENDPOINTS
  // ==========================================
  
  app.get("/api/transcode-profiles", requireAuth, async (_req, res) => {
    try {
      const profiles = await storage.getTranscodeProfiles();
      res.json(profiles);
    } catch (error: any) {
      console.error('[API] Get transcode profiles error:', error);
      res.status(500).json({ message: error.message || "Failed to get transcode profiles" });
    }
  });

  app.get("/api/transcode-profiles/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const profile = await storage.getTranscodeProfile(id);
      if (!profile) {
        return res.status(404).json({ message: "Transcode profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      console.error('[API] Get transcode profile error:', error);
      res.status(500).json({ message: error.message || "Failed to get transcode profile" });
    }
  });

  app.post("/api/transcode-profiles", requireAdmin, async (req, res) => {
    try {
      const profile = await storage.createTranscodeProfile(req.body);
      res.status(201).json(profile);
    } catch (error: any) {
      console.error('[API] Create transcode profile error:', error);
      res.status(500).json({ message: error.message || "Failed to create transcode profile" });
    }
  });

  app.put("/api/transcode-profiles/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const profile = await storage.updateTranscodeProfile(id, req.body);
      res.json(profile);
    } catch (error: any) {
      console.error('[API] Update transcode profile error:', error);
      res.status(500).json({ message: error.message || "Failed to update transcode profile" });
    }
  });

  app.delete("/api/transcode-profiles/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteTranscodeProfile(id);
      res.json({ message: "Transcode profile deleted" });
    } catch (error: any) {
      console.error('[API] Delete transcode profile error:', error);
      res.status(500).json({ message: error.message || "Failed to delete transcode profile" });
    }
  });

  // ==========================================
  // CATCHUP SETTINGS ENDPOINTS (Batch 2)
  // ==========================================

  app.get("/api/catchup/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getCatchupSettings();
      res.json(settings || {
        enabled: false,
        retentionDays: 7,
        maxStorageGb: 100,
        autoRecordEnabled: false,
        autoRecordCategories: [],
        defaultQuality: "source",
        recordingsPath: "./recordings",
        cleanupSchedule: "0 3 * * *"
      });
    } catch (error: any) {
      console.error('[API] Get catchup settings error:', error);
      res.status(500).json({ message: error.message || "Failed to get catchup settings" });
    }
  });

  app.put("/api/catchup/settings", requireAdmin, async (req, res) => {
    try {
      const parseResult = insertCatchupSettingsSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid catchup settings", errors: parseResult.error.issues });
      }
      const settings = await storage.updateCatchupSettings(parseResult.data);
      res.json(settings);
    } catch (error: any) {
      console.error('[API] Update catchup settings error:', error);
      res.status(500).json({ message: error.message || "Failed to update catchup settings" });
    }
  });

  // Get storage usage for catchup
  app.get("/api/catchup/storage", requireAdmin, async (_req, res) => {
    try {
      const archives = await storage.getTvArchives();
      const totalBytes = archives.reduce((sum, a) => sum + (a.fileSize || 0), 0);
      const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
      
      res.json({
        totalArchives: archives.length,
        storageUsedBytes: totalBytes,
        storageUsedGb: parseFloat(totalGb),
        activeRecordings: archives.filter(a => a.status === 'recording').length,
        completedRecordings: archives.filter(a => a.status === 'completed').length
      });
    } catch (error: any) {
      console.error('[API] Get catchup storage error:', error);
      res.status(500).json({ message: error.message || "Failed to get catchup storage" });
    }
  });

  // ==========================================
  // ON-DEMAND SETTINGS ENDPOINTS (Batch 2)
  // ==========================================

  app.get("/api/on-demand/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getOnDemandSettings();
      res.json(settings || {
        enabled: true,
        vodPath: "./vod",
        autoScanEnabled: false,
        scanInterval: 60,
        transcodeEnabled: false,
        generateThumbnails: true,
        thumbnailInterval: 300,
        allowedExtensions: ["mp4", "mkv", "avi", "ts", "m2ts"],
        maxFileSize: 10240,
        autoFetchMetadata: true
      });
    } catch (error: any) {
      console.error('[API] Get on-demand settings error:', error);
      res.status(500).json({ message: error.message || "Failed to get on-demand settings" });
    }
  });

  app.put("/api/on-demand/settings", requireAdmin, async (req, res) => {
    try {
      const parseResult = insertOnDemandSettingsSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid on-demand settings", errors: parseResult.error.issues });
      }
      const settings = await storage.updateOnDemandSettings(parseResult.data);
      res.json(settings);
    } catch (error: any) {
      console.error('[API] Update on-demand settings error:', error);
      res.status(500).json({ message: error.message || "Failed to update on-demand settings" });
    }
  });

  // Get VOD statistics
  app.get("/api/on-demand/stats", requireAdmin, async (_req, res) => {
    try {
      const movies = await storage.getStreams(undefined, 'movie');
      const allSeries = await storage.getSeries();
      
      // Count episodes across all series
      let totalEpisodes = 0;
      for (const s of allSeries) {
        const episodes = await storage.getEpisodes(s.id);
        totalEpisodes += episodes.length;
      }
      
      res.json({
        totalMovies: movies.length,
        totalSeries: allSeries.length,
        totalEpisodes
      });
    } catch (error: any) {
      console.error('[API] Get on-demand stats error:', error);
      res.status(500).json({ message: error.message || "Failed to get on-demand stats" });
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
      const filename = req.params.filename as string;
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
      const filename = req.params.filename as string;
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
      const sessionId = req.params.sessionId as string;
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

      const keyId = req.params.keyId as string;
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
        packageId as string,
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
      const success = await securityService.updateDeviceTrustLevel(fingerprint as string, trustLevel);

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
      const fingerprint = req.params.fingerprint as string;
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
      const id = req.params.id as string;
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
      const id = req.params.id as string;
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

  // ===== Branding & Customization Endpoints =====

  // Create branding config
  app.post("/api/branding", requireAuth, async (req, res) => {
    try {
      const { userId, ...config } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const { brandingService } = await import('./brandingService');
      const branding = await brandingService.createBrandingConfig(userId, config);

      res.json(branding);
    } catch (error: any) {
      console.error('[API] Create branding config error:', error);
      res.status(500).json({ message: error.message || "Failed to create branding config" });
    }
  });

  // Get branding config
  app.get("/api/branding/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { brandingService } = await import('./brandingService');
      const branding = await brandingService.getBrandingConfig(Number(userId));

      res.json(branding || { message: "No branding config found" });
    } catch (error: any) {
      console.error('[API] Get branding config error:', error);
      res.status(500).json({ message: error.message || "Failed to get branding config" });
    }
  });

  // Update branding config
  app.put("/api/branding/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      const { brandingService } = await import('./brandingService');
      const branding = await brandingService.updateBrandingConfig(Number(userId), updates);

      if (!branding) {
        return res.status(404).json({ message: "Branding config not found" });
      }

      res.json(branding);
    } catch (error: any) {
      console.error('[API] Update branding config error:', error);
      res.status(500).json({ message: error.message || "Failed to update branding config" });
    }
  });

  // Delete branding config
  app.delete("/api/branding/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { brandingService } = await import('./brandingService');
      const success = await brandingService.deleteBrandingConfig(Number(userId));

      if (!success) {
        return res.status(404).json({ message: "Branding config not found" });
      }

      res.json({ message: "Branding config deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete branding config error:', error);
      res.status(500).json({ message: error.message || "Failed to delete branding config" });
    }
  });

  // Get all themes
  app.get("/api/branding/themes/all", requireAuth, async (req, res) => {
    try {
      const { brandingService } = await import('./brandingService');
      const themes = brandingService.getAllThemes();

      res.json({ themes });
    } catch (error: any) {
      console.error('[API] Get themes error:', error);
      res.status(500).json({ message: error.message || "Failed to get themes" });
    }
  });

  // Get theme by ID
  app.get("/api/branding/themes/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { brandingService } = await import('./brandingService');
      const theme = brandingService.getTheme(id);

      if (!theme) {
        return res.status(404).json({ message: "Theme not found" });
      }

      res.json(theme);
    } catch (error: any) {
      console.error('[API] Get theme error:', error);
      res.status(500).json({ message: error.message || "Failed to get theme" });
    }
  });

  // Create custom theme
  app.post("/api/branding/themes", requireAuth, async (req, res) => {
    try {
      const theme = req.body;
      const { brandingService } = await import('./brandingService');
      const created = await brandingService.createCustomTheme(theme);

      res.json(created);
    } catch (error: any) {
      console.error('[API] Create theme error:', error);
      res.status(500).json({ message: error.message || "Failed to create theme" });
    }
  });

  // Update theme
  app.put("/api/branding/themes/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const { brandingService } = await import('./brandingService');
      const updated = await brandingService.updateTheme(id, updates);

      if (!updated) {
        return res.status(404).json({ message: "Theme not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[API] Update theme error:', error);
      res.status(500).json({ message: error.message || "Failed to update theme" });
    }
  });

  // Delete theme
  app.delete("/api/branding/themes/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { brandingService } = await import('./brandingService');
      const success = await brandingService.deleteTheme(id);

      if (!success) {
        return res.status(400).json({ message: "Cannot delete default theme or theme not found" });
      }

      res.json({ message: "Theme deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete theme error:', error);
      res.status(500).json({ message: error.message || "Failed to delete theme" });
    }
  });

  // Create custom page
  app.post("/api/branding/pages", requireAuth, async (req, res) => {
    try {
      const { userId, ...page } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const { brandingService } = await import('./brandingService');
      const created = await brandingService.createCustomPage(userId, page);

      res.json(created);
    } catch (error: any) {
      console.error('[API] Create custom page error:', error);
      res.status(500).json({ message: error.message || "Failed to create custom page" });
    }
  });

  // Get custom pages for user
  app.get("/api/branding/pages/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { brandingService } = await import('./brandingService');
      const pages = brandingService.getUserCustomPages(Number(userId));

      res.json({ pages });
    } catch (error: any) {
      console.error('[API] Get custom pages error:', error);
      res.status(500).json({ message: error.message || "Failed to get custom pages" });
    }
  });

  // Update custom page
  app.put("/api/branding/pages/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const { brandingService } = await import('./brandingService');
      const updated = await brandingService.updateCustomPage(id, updates);

      if (!updated) {
        return res.status(404).json({ message: "Custom page not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[API] Update custom page error:', error);
      res.status(500).json({ message: error.message || "Failed to update custom page" });
    }
  });

  // Delete custom page
  app.delete("/api/branding/pages/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { brandingService } = await import('./brandingService');
      const success = await brandingService.deleteCustomPage(id);

      if (!success) {
        return res.status(404).json({ message: "Custom page not found" });
      }

      res.json({ message: "Custom page deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete custom page error:', error);
      res.status(500).json({ message: error.message || "Failed to delete custom page" });
    }
  });

  // Generate custom CSS
  app.get("/api/branding/:userId/css", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { brandingService } = await import('./brandingService');
      const branding = await brandingService.getBrandingConfig(Number(userId));

      if (!branding) {
        return res.status(404).json({ message: "Branding config not found" });
      }

      const css = brandingService.generateCustomCss(branding);
      
      res.setHeader('Content-Type', 'text/css');
      res.send(css);
    } catch (error: any) {
      console.error('[API] Generate CSS error:', error);
      res.status(500).json({ message: error.message || "Failed to generate CSS" });
    }
  });

  // ===== Backup & Recovery Endpoints =====

  // Create backup
  app.post("/api/backups", requireAuth, async (req, res) => {
    try {
      const { type } = req.body;
      
      if (!['full', 'incremental', 'database', 'files'].includes(type)) {
        return res.status(400).json({ message: "Invalid backup type" });
      }

      const { backupService } = await import('./backupService');
      const backup = await backupService.createBackup(type);

      res.json(backup);
    } catch (error: any) {
      console.error('[API] Create backup error:', error);
      res.status(500).json({ message: error.message || "Failed to create backup" });
    }
  });

  // List backups
  app.get("/api/backups", requireAuth, async (req, res) => {
    try {
      const { type, limit } = req.query;
      const { backupService } = await import('./backupService');
      const backups = backupService.listBackups(
        type as any,
        limit ? Number(limit) : 50
      );

      res.json({ backups });
    } catch (error: any) {
      console.error('[API] List backups error:', error);
      res.status(500).json({ message: error.message || "Failed to list backups" });
    }
  });

  // Get backup
  app.get("/api/backups/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { backupService } = await import('./backupService');
      const backup = backupService.getBackup(id);

      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json(backup);
    } catch (error: any) {
      console.error('[API] Get backup error:', error);
      res.status(500).json({ message: error.message || "Failed to get backup" });
    }
  });

  // Delete backup
  app.delete("/api/backups/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { backupService } = await import('./backupService');
      const success = await backupService.deleteBackup(id);

      if (!success) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json({ message: "Backup deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete backup error:', error);
      res.status(500).json({ message: error.message || "Failed to delete backup" });
    }
  });

  // Restore backup
  app.post("/api/backups/:id/restore", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { verify } = req.body;
      const { backupService } = await import('./backupService');
      
      await backupService.restoreBackup(id, { verify });

      res.json({ message: "Backup restored successfully" });
    } catch (error: any) {
      console.error('[API] Restore backup error:', error);
      res.status(500).json({ message: error.message || "Failed to restore backup" });
    }
  });

  // Verify backup
  app.post("/api/backups/:id/verify", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { backupService } = await import('./backupService');
      const valid = await backupService.verifyBackup(id);

      res.json({ valid });
    } catch (error: any) {
      console.error('[API] Verify backup error:', error);
      res.status(500).json({ message: error.message || "Failed to verify backup" });
    }
  });

  // Get backup stats
  app.get("/api/backups/stats/summary", requireAuth, async (req, res) => {
    try {
      const { backupService } = await import('./backupService');
      const stats = backupService.getBackupStats();

      res.json(stats);
    } catch (error: any) {
      console.error('[API] Get backup stats error:', error);
      res.status(500).json({ message: error.message || "Failed to get backup stats" });
    }
  });

  // Create backup schedule
  app.post("/api/backups/schedules", requireAuth, async (req, res) => {
    try {
      const schedule = req.body;
      const { backupService } = await import('./backupService');
      const created = await backupService.createSchedule(schedule);

      res.json(created);
    } catch (error: any) {
      console.error('[API] Create backup schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to create backup schedule" });
    }
  });

  // List backup schedules
  app.get("/api/backups/schedules/all", requireAuth, async (req, res) => {
    try {
      const { backupService } = await import('./backupService');
      const schedules = backupService.listSchedules();

      res.json({ schedules });
    } catch (error: any) {
      console.error('[API] List backup schedules error:', error);
      res.status(500).json({ message: error.message || "Failed to list backup schedules" });
    }
  });

  // Get backup schedule
  app.get("/api/backups/schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { backupService } = await import('./backupService');
      const schedule = backupService.getSchedule(id);

      if (!schedule) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.json(schedule);
    } catch (error: any) {
      console.error('[API] Get backup schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to get backup schedule" });
    }
  });

  // Update backup schedule
  app.put("/api/backups/schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const { backupService } = await import('./backupService');
      const updated = await backupService.updateSchedule(id, updates);

      if (!updated) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[API] Update backup schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to update backup schedule" });
    }
  });

  // Delete backup schedule
  app.delete("/api/backups/schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { backupService } = await import('./backupService');
      const success = await backupService.deleteSchedule(id);

      if (!success) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.json({ message: "Backup schedule deleted successfully" });
    } catch (error: any) {
      console.error('[API] Delete backup schedule error:', error);
      res.status(500).json({ message: error.message || "Failed to delete backup schedule" });
    }
  });

  // Get restore points
  app.get("/api/backups/restore-points", requireAuth, async (req, res) => {
    try {
      const { backupService } = await import('./backupService');
      const restorePoints = backupService.getRestorePoints();

      res.json({ restorePoints });
    } catch (error: any) {
      console.error('[API] Get restore points error:', error);
      res.status(500).json({ message: error.message || "Failed to get restore points" });
    }
  });

  // ===== Webhook Endpoints =====

  app.post("/api/webhooks", requireAuth, async (req, res) => {
    try {
      const { webhookService } = await import('./webhookService');
      const webhook = await webhookService.createWebhook(req.body);
      res.json(webhook);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create webhook" });
    }
  });

  app.get("/api/webhooks", requireAuth, async (req, res) => {
    try {
      const { webhookService } = await import('./webhookService');
      const webhooks = webhookService.listWebhooks();
      res.json({ webhooks });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/webhooks/:id", requireAuth, async (req, res) => {
    try {
      const { webhookService } = await import('./webhookService');
      const webhook = await webhookService.updateWebhook(req.params.id as string, req.body);
      if (!webhook) return res.status(404).json({ message: "Webhook not found" });
      res.json(webhook);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/webhooks/:id", requireAuth, async (req, res) => {
    try {
      const { webhookService } = await import('./webhookService');
      await webhookService.deleteWebhook(req.params.id as string);
      res.json({ message: "Webhook deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/webhooks/:id/deliveries", requireAuth, async (req, res) => {
    try {
      const { webhookService } = await import('./webhookService');
      const deliveries = webhookService.getDeliveries(req.params.id as string);
      res.json({ deliveries });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== Cron Job Endpoints =====

  app.post("/api/cron-jobs", requireAuth, async (req, res) => {
    try {
      const { cronJobService } = await import('./cronJobService');
      const job = await cronJobService.createJob(req.body);
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cron-jobs", requireAuth, async (req, res) => {
    try {
      const { cronJobService } = await import('./cronJobService');
      const jobs = cronJobService.listJobs();
      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/cron-jobs/:id", requireAuth, async (req, res) => {
    try {
      const { cronJobService } = await import('./cronJobService');
      const job = await cronJobService.updateJob(req.params.id as string, req.body);
      if (!job) return res.status(404).json({ message: "Job not found" });
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/cron-jobs/:id", requireAuth, async (req, res) => {
    try {
      const { cronJobService } = await import('./cronJobService');
      await cronJobService.deleteJob(req.params.id as string);
      res.json({ message: "Job deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cron-jobs/:id/run", requireAuth, async (req, res) => {
    try {
      const { cronJobService } = await import('./cronJobService');
      await cronJobService.runJobNow(req.params.id as string);
      res.json({ message: "Job executed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== Monitoring Endpoints =====

  app.get("/api/monitoring/metrics", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      const metrics = monitoringService.getLatestMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/monitoring/health", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      const health = monitoringService.getHealthChecks();
      const overall = monitoringService.getOverallHealth();
      res.json({ health, overall });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/monitoring/alerts", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      const alert = await monitoringService.createAlert(req.body);
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/monitoring/alerts", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      const alerts = monitoringService.listAlerts();
      res.json({ alerts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/monitoring/alerts/:id", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      const alert = await monitoringService.updateAlert(req.params.id as string, req.body);
      if (!alert) return res.status(404).json({ message: "Alert not found" });
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/monitoring/alerts/:id", requireAuth, async (req, res) => {
    try {
      const { monitoringService } = await import('./monitoringService');
      await monitoringService.deleteAlert(req.params.id as string);
      res.json({ message: "Alert deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  app.post(api.bouquets.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.bouquets.create.input.parse(req.body);
      const bouquet = await storage.createBouquet(input);
      res.status(201).json(bouquet);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.bouquets.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.bouquets.update.input.parse(req.body);
      const bouquet = await storage.updateBouquet(Number(req.params.id), input);
      res.json(bouquet);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.bouquets.delete.path, requireAuth, async (req, res) => {
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

  app.post(api.lines.create.path, requireAuth, async (req, res) => {
    try {
      const { useCredits, creditCost, ...lineData } = req.body;
      // Convert expDate string to Date object if provided
      if (lineData.expDate && typeof lineData.expDate === 'string') {
        lineData.expDate = new Date(lineData.expDate);
      }
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.lines.update.path, requireAuth, async (req, res) => {
    try {
      // Convert expDate string to Date object if provided
      if (req.body.expDate && typeof req.body.expDate === 'string') {
        req.body.expDate = new Date(req.body.expDate);
      }
      const input = api.lines.update.input.parse(req.body);
      const line = await storage.updateLine(Number(req.params.id), input);
      res.json(line);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.lines.delete.path, requireAuth, async (req, res) => {
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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

  app.post(api.servers.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.servers.create.input.parse(req.body);
      const server = await storage.createServer(input);
      res.status(201).json(server);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.servers.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.servers.update.input.parse(req.body);
      const server = await storage.updateServer(Number(req.params.id), input);
      res.json(server);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.servers.delete.path, requireAdmin, async (req, res) => {
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

  app.post(api.epgSources.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.epgSources.create.input.parse(req.body);
      const source = await storage.createEpgSource(input);
      res.status(201).json(source);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.epgSources.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.epgSources.update.input.parse(req.body);
      const source = await storage.updateEpgSource(Number(req.params.id), input);
      res.json(source);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.epgSources.delete.path, requireAuth, async (req, res) => {
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

  app.post(api.series.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.series.create.input.parse(req.body);
      const s = await storage.createSeries(input);
      res.status(201).json(s);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.series.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.series.update.input.parse(req.body);
      const s = await storage.updateSeries(Number(req.params.id), input);
      res.json(s);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.series.delete.path, requireAuth, async (req, res) => {
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

  app.post(api.episodes.create.path, requireAuth, async (req, res) => {
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.put(api.episodes.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.episodes.update.input.parse(req.body);
      const episode = await storage.updateEpisode(Number(req.params.id), input);
      res.json(episode);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.episodes.delete.path, requireAuth, async (req, res) => {
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
    const template = await storage.getDeviceTemplate(req.params.id as string);
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
      return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
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
    const setting = await storage.getSetting(req.params.key as string);
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
      const existing = await storage.getSetting(req.params.key as string);
      if (!existing) return res.status(404).json({ message: "Setting not found" });
      const setting = await storage.updateSetting(req.params.key as string, value);
      res.json(setting);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/settings/:key", requireAdmin, async (req, res) => {
    await storage.deleteSetting(req.params.key as string);
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
    const isReserved = await storage.isUsernameReserved(req.params.username as string);
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
      const userId = req.session.userId!;
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
      const userId = req.session.userId!;
      const lines = await storage.getLines();
      const myLines = lines.filter(l => l.memberId === userId);
      res.json(myLines);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  
  // Reseller update line
  app.put("/api/reseller/lines/:id", requireReseller, async (req, res) => {
    try {
      const userId = req.session.userId!;
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
      const userId = req.session.userId!;
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
      const userId = req.session.userId!;
      const transactions = await storage.getCreditTransactions(userId);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 1: VPN DETECTION, SHOP, SSL, EMBEDDED LINES
  // ============================================
  
  // Import services
  const vpnDetection = await import("./services/vpnDetection");
  const shopService = await import("./services/shop");
  const embeddedLinesService = await import("./services/embeddedLines");
  const sslService = await import("./services/sslCertificates");

  // ----- VPN DETECTION ROUTES -----
  
  // Get VPN detection settings
  app.get("/api/vpn-detection/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await vpnDetection.getVpnDetectionSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update VPN detection settings
  app.put("/api/vpn-detection/settings", requireAdmin, async (req, res) => {
    try {
      const updated = await vpnDetection.updateVpnDetectionSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get VPN detection logs
  app.get("/api/vpn-detection/logs", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const offset = Number(req.query.offset) || 0;
      const logs = await vpnDetection.getVpnDetectionLogs(limit, offset);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Check IP for VPN/Proxy
  app.get("/api/vpn-detection/check/:ip", requireAdmin, async (req, res) => {
    try {
      const ip = String(req.params.ip);
      const result = await vpnDetection.checkVpnProxy(ip);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Lookup IP info
  app.get("/api/vpn-detection/lookup/:ip", requireAdmin, async (req, res) => {
    try {
      const ip = String(req.params.ip);
      const result = await vpnDetection.lookupIp(ip);
      res.json(result || { message: "Could not lookup IP" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get VPN IP ranges (local database)
  app.get("/api/vpn-detection/ip-ranges", requireAdmin, async (_req, res) => {
    try {
      const ranges = await vpnDetection.getVpnIpRanges();
      res.json(ranges);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Add VPN IP range
  app.post("/api/vpn-detection/ip-ranges", requireAdmin, async (req, res) => {
    try {
      const range = await vpnDetection.addVpnIpRange(req.body);
      res.json(range);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete VPN IP range
  app.delete("/api/vpn-detection/ip-ranges/:id", requireAdmin, async (req, res) => {
    try {
      await vpnDetection.deleteVpnIpRange(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Clear VPN cache
  app.post("/api/vpn-detection/clear-cache", requireAdmin, async (_req, res) => {
    try {
      await vpnDetection.clearVpnCache();
      res.json({ message: "Cache cleared" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ----- SHOP ROUTES -----

  // Public: Get shop products
  app.get("/api/shop/products", async (_req, res) => {
    try {
      const products = await shopService.getProducts(true);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Get all products (including disabled)
  app.get("/api/shop/products/all", requireAdmin, async (_req, res) => {
    try {
      const products = await shopService.getProducts(false);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get single product
  app.get("/api/shop/products/:id", async (req, res) => {
    try {
      const product = await shopService.getProduct(Number(req.params.id));
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create product
  app.post("/api/shop/products", requireAdmin, async (req, res) => {
    try {
      const product = await shopService.createProduct(req.body);
      res.json(product);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update product
  app.put("/api/shop/products/:id", requireAdmin, async (req, res) => {
    try {
      const product = await shopService.updateProduct(Number(req.params.id), req.body);
      res.json(product);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete product
  app.delete("/api/shop/products/:id", requireAdmin, async (req, res) => {
    try {
      await shopService.deleteProduct(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Public: Get payment methods
  app.get("/api/shop/payment-methods", async (_req, res) => {
    try {
      const methods = await shopService.getPaymentMethods(true);
      const safeMethods = methods.map(m => ({
        id: m.id,
        name: m.name,
        methodType: m.methodType,
        displayName: m.displayName,
        icon: m.icon,
        instructions: m.instructions,
      }));
      res.json(safeMethods);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Get all payment methods with full details
  app.get("/api/shop/payment-methods/all", requireAdmin, async (_req, res) => {
    try {
      const methods = await shopService.getPaymentMethods(false);
      res.json(methods);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create payment method
  app.post("/api/shop/payment-methods", requireAdmin, async (req, res) => {
    try {
      const method = await shopService.createPaymentMethod(req.body);
      res.json(method);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update payment method
  app.put("/api/shop/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      const method = await shopService.updatePaymentMethod(Number(req.params.id), req.body);
      res.json(method);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete payment method
  app.delete("/api/shop/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      await shopService.deletePaymentMethod(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Public: Create order
  app.post("/api/shop/orders", async (req, res) => {
    try {
      const order = await shopService.createOrder({
        productId: req.body.productId,
        guestEmail: req.body.email,
        guestName: req.body.name,
        paymentMethodId: req.body.paymentMethodId,
        customerNotes: req.body.notes,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get order by order number (public for customers to check status)
  app.get("/api/shop/orders/track/:orderNumber", async (req, res) => {
    try {
      const order = await shopService.getOrderByNumber(req.params.orderNumber);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const safeOrder = {
        orderNumber: order.orderNumber,
        productName: order.productName,
        totalPrice: order.totalPrice,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        fulfilled: order.fulfilled,
        createdAt: order.createdAt,
        generatedUsername: order.fulfilled ? order.generatedUsername : undefined,
        generatedPassword: order.fulfilled ? order.generatedPassword : undefined,
      };
      res.json(safeOrder);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Get all orders
  app.get("/api/shop/orders", requireAdmin, async (req, res) => {
    try {
      const orders = await shopService.getOrders({
        status: req.query.status as string,
        limit: Number(req.query.limit) || 100,
        offset: Number(req.query.offset) || 0,
      });
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Get single order
  app.get("/api/shop/orders/:id", requireAdmin, async (req, res) => {
    try {
      const order = await shopService.getOrder(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Update order payment
  app.post("/api/shop/orders/:id/payment", requireAdmin, async (req, res) => {
    try {
      const order = await shopService.updateOrderPayment(
        Number(req.params.id),
        req.body.transactionId || 'manual',
        req.body.status
      );
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Admin: Fulfill order manually
  app.post("/api/shop/orders/:id/fulfill", requireAdmin, async (req, res) => {
    try {
      const order = await shopService.fulfillOrder(Number(req.params.id));
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Admin: Cancel order
  app.post("/api/shop/orders/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const order = await shopService.cancelOrder(Number(req.params.id), req.body.reason);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Admin: Refund order
  app.post("/api/shop/orders/:id/refund", requireAdmin, async (req, res) => {
    try {
      const order = await shopService.refundOrder(Number(req.params.id), req.body.reason);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Admin: Get shop stats
  app.get("/api/shop/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await shopService.getShopStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Shop settings
  app.get("/api/shop/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await shopService.getAllSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/shop/settings", requireAdmin, async (req, res) => {
    try {
      await shopService.setSetting(req.body.key, req.body.value, req.body.type, req.body.description);
      res.json({ message: "Setting saved" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ----- EMBEDDED LINES ROUTES -----

  // Get all embedded lines
  app.get("/api/embedded-lines", requireAdmin, async (_req, res) => {
    try {
      const embedded = await embeddedLinesService.getAllEmbeddedLines();
      res.json(embedded);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get embedded line by ID
  app.get("/api/embedded-lines/:id", requireAdmin, async (req, res) => {
    try {
      const embedded = await embeddedLinesService.getEmbeddedLine(Number(req.params.id));
      if (!embedded) return res.status(404).json({ message: "Embedded line not found" });
      res.json(embedded);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get embedded line for a line
  app.get("/api/lines/:lineId/embed", requireAdmin, async (req, res) => {
    try {
      const embedded = await embeddedLinesService.getEmbeddedLineByLineId(Number(req.params.lineId));
      res.json(embedded || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create/update embedded line
  app.post("/api/embedded-lines", requireAdmin, async (req, res) => {
    try {
      const embedded = await embeddedLinesService.createEmbeddedLine(req.body);
      res.json(embedded);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update embedded line
  app.put("/api/embedded-lines/:id", requireAdmin, async (req, res) => {
    try {
      const embedded = await embeddedLinesService.updateEmbeddedLine(Number(req.params.id), req.body);
      res.json(embedded);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete embedded line
  app.delete("/api/embedded-lines/:id", requireAdmin, async (req, res) => {
    try {
      await embeddedLinesService.deleteEmbeddedLine(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Regenerate embed token
  app.post("/api/embedded-lines/:id/regenerate-token", requireAdmin, async (req, res) => {
    try {
      const embedded = await embeddedLinesService.regenerateToken(Number(req.params.id));
      res.json(embedded);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Public: Validate embed access and get stream
  app.get("/api/embed/:token", async (req, res) => {
    try {
      const domain = req.headers.origin || req.headers.referer;
      const ip = req.ip;
      const validation = await embeddedLinesService.validateEmbedAccess(
        req.params.token,
        domain ? new URL(domain).hostname : undefined,
        ip
      );
      if (!validation.valid) {
        return res.status(403).json({ message: validation.reason });
      }
      res.json({ valid: true, username: validation.line?.username });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: Get embed playlist
  app.get("/api/embed/:token/playlist", async (req, res) => {
    try {
      const playlist = await embeddedLinesService.getEmbedPlaylist(req.params.token);
      if (!playlist) return res.status(403).json({ message: "Invalid token" });
      res.redirect(playlist);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: Get embed stream URL
  app.get("/api/embed/:token/stream/:streamId", async (req, res) => {
    try {
      const format = (req.query.format as string) || 'm3u8';
      const url = await embeddedLinesService.getEmbedPlayerUrl(
        req.params.token,
        Number(req.params.streamId),
        format
      );
      if (!url) return res.status(403).json({ message: "Invalid token" });
      res.redirect(url);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ----- SSL CERTIFICATE ROUTES -----

  // Get all certificates
  app.get("/api/ssl-certificates", requireAdmin, async (_req, res) => {
    try {
      const certs = await sslService.getCertificates();
      res.json(certs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get single certificate
  app.get("/api/ssl-certificates/:id", requireAdmin, async (req, res) => {
    try {
      const cert = await sslService.getCertificate(Number(req.params.id));
      if (!cert) return res.status(404).json({ message: "Certificate not found" });
      res.json(cert);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create certificate record
  app.post("/api/ssl-certificates", requireAdmin, async (req, res) => {
    try {
      const cert = await sslService.createCertificateRecord(req.body);
      res.json(cert);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update certificate
  app.put("/api/ssl-certificates/:id", requireAdmin, async (req, res) => {
    try {
      const cert = await sslService.updateCertificate(Number(req.params.id), req.body);
      res.json(cert);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete certificate
  app.delete("/api/ssl-certificates/:id", requireAdmin, async (req, res) => {
    try {
      await sslService.deleteCertificate(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Request certificate from Let's Encrypt
  app.post("/api/ssl-certificates/:id/request", requireAdmin, async (req, res) => {
    try {
      const result = await sslService.requestCertificate(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Renew certificate
  app.post("/api/ssl-certificates/:id/renew", requireAdmin, async (req, res) => {
    try {
      const result = await sslService.renewCertificate(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Check expiring certificates
  app.get("/api/ssl-certificates/check/expiring", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 30;
      const expiring = await sslService.checkExpiringCertificates(days);
      res.json(expiring);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Auto-renew expiring certificates
  app.post("/api/ssl-certificates/auto-renew", requireAdmin, async (_req, res) => {
    try {
      const results = await sslService.autoRenewExpiring();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get Nginx SSL config
  app.get("/api/ssl-certificates/:id/nginx-config", requireAdmin, async (req, res) => {
    try {
      const cert = await sslService.getCertificate(Number(req.params.id));
      if (!cert) return res.status(404).json({ message: "Certificate not found" });
      const config = sslService.generateNginxSslConfig(cert.domain);
      res.type('text/plain').send(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get install script
  app.get("/api/ssl-certificates/install-script", requireAdmin, async (_req, res) => {
    try {
      const script = sslService.generateInstallScript();
      res.type('text/plain').send(script);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 3: LOAD BALANCING & MULTI-SERVER
  // ============================================

  // Get load balancing settings
  app.get("/api/load-balancing/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await db.select().from(loadBalancingSettings).limit(1);
      if (settings.length === 0) {
        // Create default settings
        const [newSettings] = await db.insert(loadBalancingSettings).values({}).returning();
        return res.json(newSettings);
      }
      res.json(settings[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update load balancing settings
  app.put("/api/load-balancing/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await db.select().from(loadBalancingSettings).limit(1);
      if (settings.length === 0) {
        const [newSettings] = await db.insert(loadBalancingSettings).values(req.body).returning();
        return res.json(newSettings);
      }
      const [updated] = await db.update(loadBalancingSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(loadBalancingSettings.id, settings[0].id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get all servers with health info
  app.get("/api/load-balancing/servers", requireAdmin, async (_req, res) => {
    try {
      const allServers = await storage.getServers();
      const serverHealth = await Promise.all(allServers.map(async (server) => {
        const healthLogs = await db.select()
          .from(serverHealthLogs)
          .where(eq(serverHealthLogs.serverId, server.id))
          .orderBy(desc(serverHealthLogs.createdAt))
          .limit(1);
        return {
          ...server,
          lastHealth: healthLogs[0] || null,
        };
      }));
      res.json(serverHealth);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get server health history
  app.get("/api/load-balancing/servers/:id/health", requireAdmin, async (req, res) => {
    try {
      const hours = Number(req.query.hours) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const logs = await db.select()
        .from(serverHealthLogs)
        .where(and(
          eq(serverHealthLogs.serverId, Number(req.params.id)),
          gte(serverHealthLogs.createdAt, since)
        ))
        .orderBy(serverHealthLogs.createdAt);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Trigger health check for a server
  app.post("/api/load-balancing/servers/:id/health-check", requireAdmin, async (req, res) => {
    try {
      const server = await storage.getServer(Number(req.params.id));
      if (!server) return res.status(404).json({ message: "Server not found" });
      
      // Import and use multiServer service
      const { checkServerHealth } = await import("./services/multiServer");
      const health = await checkServerHealth(server.id);
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get load balancing rules
  app.get("/api/load-balancing/rules", requireAdmin, async (_req, res) => {
    try {
      const rules = await db.select().from(loadBalancingRules).orderBy(loadBalancingRules.priority);
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create load balancing rule
  app.post("/api/load-balancing/rules", requireAdmin, async (req, res) => {
    try {
      const [rule] = await db.insert(loadBalancingRules).values(req.body).returning();
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update load balancing rule
  app.put("/api/load-balancing/rules/:id", requireAdmin, async (req, res) => {
    try {
      const [rule] = await db.update(loadBalancingRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(loadBalancingRules.id, Number(req.params.id)))
        .returning();
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete load balancing rule
  app.delete("/api/load-balancing/rules/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(loadBalancingRules).where(eq(loadBalancingRules.id, Number(req.params.id)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get failover history
  app.get("/api/load-balancing/failover-history", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const history = await db.select()
        .from(serverFailoverHistory)
        .orderBy(desc(serverFailoverHistory.createdAt))
        .limit(limit);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Manual failover trigger
  app.post("/api/load-balancing/failover", requireAdmin, async (req, res) => {
    try {
      const { fromServerId, toServerId, reason } = req.body;
      const { triggerFailover } = await import("./services/multiServer");
      const result = await triggerFailover(fromServerId, toServerId, reason || "Manual failover");
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get load balancing statistics
  app.get("/api/load-balancing/stats", requireAdmin, async (_req, res) => {
    try {
      const allServers = await storage.getServers();
      const onlineServers = allServers.filter(s => s.status === 'online' && s.enabled);
      const totalConnections = allServers.reduce((sum, s) => sum + (s.currentClients || 0), 0);
      const avgCpu = onlineServers.length > 0 
        ? onlineServers.reduce((sum, s) => sum + (s.cpuUsage || 0), 0) / onlineServers.length 
        : 0;
      const avgMemory = onlineServers.length > 0 
        ? onlineServers.reduce((sum, s) => sum + (s.memoryUsage || 0), 0) / onlineServers.length 
        : 0;
      
      res.json({
        totalServers: allServers.length,
        onlineServers: onlineServers.length,
        offlineServers: allServers.length - onlineServers.length,
        totalConnections,
        avgCpuUsage: Math.round(avgCpu * 100) / 100,
        avgMemoryUsage: Math.round(avgMemory * 100) / 100,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 3: GEOIP RESTRICTIONS
  // ============================================

  // Get GeoIP settings
  app.get("/api/geoip/settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await db.select().from(geoipSettings).limit(1);
      if (settings.length === 0) {
        const [newSettings] = await db.insert(geoipSettings).values({}).returning();
        return res.json(newSettings);
      }
      res.json(settings[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update GeoIP settings
  app.put("/api/geoip/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await db.select().from(geoipSettings).limit(1);
      if (settings.length === 0) {
        const [newSettings] = await db.insert(geoipSettings).values(req.body).returning();
        return res.json(newSettings);
      }
      const [updated] = await db.update(geoipSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(geoipSettings.id, settings[0].id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get GeoIP logs
  app.get("/api/geoip/logs", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const action = req.query.action as string;
      const conditions = [];
      if (action) conditions.push(eq(geoipLogs.action, action));
      
      const logs = await db.select()
        .from(geoipLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(geoipLogs.createdAt))
        .limit(limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Lookup IP geolocation
  app.get("/api/geoip/lookup/:ip", requireAdmin, async (req, res) => {
    try {
      const ip = req.params.ip;
      // Use ip-api.com free service for lookup
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get line GeoIP restrictions
  app.get("/api/geoip/lines/:lineId", requireAdmin, async (req, res) => {
    try {
      const line = await storage.getLine(Number(req.params.lineId));
      if (!line) return res.status(404).json({ message: "Line not found" });
      res.json({
        lineId: line.id,
        username: line.username,
        allowedCountries: line.allowedCountries || [],
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update line GeoIP restrictions
  app.put("/api/geoip/lines/:lineId", requireAdmin, async (req, res) => {
    try {
      const { allowedCountries } = req.body;
      const updated = await storage.updateLine(Number(req.params.lineId), { allowedCountries });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Check IP against line restrictions
  app.post("/api/geoip/check", requireAdmin, async (req, res) => {
    try {
      const { lineId, ipAddress } = req.body;
      const line = await storage.getLine(lineId);
      if (!line) return res.status(404).json({ message: "Line not found" });
      
      // Get IP geolocation
      const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=countryCode`);
      const data = await response.json();
      
      const allowed = !line.allowedCountries || 
        line.allowedCountries.length === 0 || 
        line.allowedCountries.includes(data.countryCode);
      
      // Log the check
      await db.insert(geoipLogs).values({
        lineId,
        ipAddress,
        countryCode: data.countryCode,
        action: allowed ? 'allowed' : 'blocked',
        reason: allowed ? 'allowed' : 'country_not_in_whitelist',
      });
      
      res.json({ 
        allowed, 
        countryCode: data.countryCode,
        allowedCountries: line.allowedCountries || [] 
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get GeoIP statistics
  app.get("/api/geoip/stats", requireAdmin, async (_req, res) => {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const logs = await db.select().from(geoipLogs).where(gte(geoipLogs.createdAt, last24h));
      
      const allowed = logs.filter(l => l.action === 'allowed').length;
      const blocked = logs.filter(l => l.action === 'blocked').length;
      
      // Group by country
      const byCountry: Record<string, { allowed: number; blocked: number }> = {};
      logs.forEach(log => {
        const country = log.countryCode || 'Unknown';
        if (!byCountry[country]) byCountry[country] = { allowed: 0, blocked: 0 };
        if (log.action === 'allowed') byCountry[country].allowed++;
        else byCountry[country].blocked++;
      });
      
      res.json({
        last24h: { allowed, blocked, total: logs.length },
        byCountry,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 3: BANDWIDTH MONITORING
  // ============================================

  // Get bandwidth overview
  app.get("/api/bandwidth/overview", requireAdmin, async (_req, res) => {
    try {
      const { getRealTimeBandwidthOverview } = await import("./services/bandwidthMonitor");
      const overview = await getRealTimeBandwidthOverview();
      res.json(overview);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get bandwidth stats
  app.get("/api/bandwidth/stats", requireAdmin, async (req, res) => {
    try {
      const hours = Number(req.query.hours) || 24;
      const serverId = req.query.serverId ? Number(req.query.serverId) : undefined;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const endTime = new Date();
      
      const { getBandwidthStats } = await import("./services/bandwidthMonitor");
      const stats = await getBandwidthStats(startTime, endTime, { serverId });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get bandwidth alerts
  app.get("/api/bandwidth/alerts", requireAdmin, async (_req, res) => {
    try {
      const alerts = await db.select().from(bandwidthAlerts).orderBy(desc(bandwidthAlerts.createdAt));
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create bandwidth alert
  app.post("/api/bandwidth/alerts", requireAdmin, async (req, res) => {
    try {
      const [alert] = await db.insert(bandwidthAlerts).values(req.body).returning();
      res.json(alert);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update bandwidth alert
  app.put("/api/bandwidth/alerts/:id", requireAdmin, async (req, res) => {
    try {
      const [alert] = await db.update(bandwidthAlerts)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(bandwidthAlerts.id, Number(req.params.id)))
        .returning();
      res.json(alert);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Delete bandwidth alert
  app.delete("/api/bandwidth/alerts/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(bandwidthAlerts).where(eq(bandwidthAlerts.id, Number(req.params.id)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get notification history
  app.get("/api/bandwidth/notifications", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const notifications = await db.select()
        .from(notificationHistory)
        .orderBy(desc(notificationHistory.createdAt))
        .limit(limit);
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Test notification
  app.post("/api/bandwidth/test-notification", requireAdmin, async (req, res) => {
    try {
      const { type, recipient, message } = req.body;
      
      // Record test notification
      const [notification] = await db.insert(notificationHistory).values({
        type,
        recipient,
        message: message || 'Test notification from PanelX',
        subject: 'Test Alert',
        status: 'pending',
      }).returning();
      
      // Simulate sending (in production, integrate with email/SMS/webhook)
      await db.update(notificationHistory)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(notificationHistory.id, notification.id));
      
      res.json({ success: true, notification });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get per-line bandwidth usage
  app.get("/api/bandwidth/lines/:lineId", requireAdmin, async (req, res) => {
    try {
      const hours = Number(req.query.hours) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const stats = await db.select()
        .from(bandwidthStats)
        .where(and(
          eq(bandwidthStats.lineId, Number(req.params.lineId)),
          gte(bandwidthStats.periodStart, since)
        ))
        .orderBy(bandwidthStats.periodStart);
      
      const total = stats.reduce((sum, s) => ({
        bytesIn: sum.bytesIn + (s.bytesIn || 0),
        bytesOut: sum.bytesOut + (s.bytesOut || 0),
        bytesTotal: sum.bytesTotal + (s.bytesTotal || 0),
      }), { bytesIn: 0, bytesOut: 0, bytesTotal: 0 });
      
      res.json({ stats, total });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get per-server bandwidth usage
  app.get("/api/bandwidth/servers/:serverId", requireAdmin, async (req, res) => {
    try {
      const hours = Number(req.query.hours) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const stats = await db.select()
        .from(bandwidthStats)
        .where(and(
          eq(bandwidthStats.serverId, Number(req.params.serverId)),
          gte(bandwidthStats.periodStart, since)
        ))
        .orderBy(bandwidthStats.periodStart);
      
      const total = stats.reduce((sum, s) => ({
        bytesIn: sum.bytesIn + (s.bytesIn || 0),
        bytesOut: sum.bytesOut + (s.bytesOut || 0),
        bytesTotal: sum.bytesTotal + (s.bytesTotal || 0),
      }), { bytesIn: 0, bytesOut: 0, bytesTotal: 0 });
      
      res.json({ stats, total });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 3: RESELLER PORTAL ENHANCEMENTS
  // ============================================

  // Get reseller permissions
  app.get("/api/reseller/permissions/:userId", requireAdmin, async (req, res) => {
    try {
      const permissions = await db.select()
        .from(resellerPermissions)
        .where(eq(resellerPermissions.userId, Number(req.params.userId)));
      res.json(permissions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Set reseller permissions
  app.put("/api/reseller/permissions/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const { permissions } = req.body; // Array of permission objects
      
      // Delete existing permissions
      await db.delete(resellerPermissions).where(eq(resellerPermissions.userId, userId));
      
      // Insert new permissions
      if (permissions && permissions.length > 0) {
        const toInsert = permissions.map((p: any) => ({
          userId,
          resource: p.resource,
          canCreate: p.canCreate || false,
          canRead: p.canRead !== false,
          canUpdate: p.canUpdate || false,
          canDelete: p.canDelete || false,
        }));
        await db.insert(resellerPermissions).values(toInsert);
      }
      
      const updated = await db.select()
        .from(resellerPermissions)
        .where(eq(resellerPermissions.userId, userId));
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get reseller settings
  app.get("/api/reseller/settings/:userId", requireAdmin, async (req, res) => {
    try {
      const settings = await db.select()
        .from(resellerSettings)
        .where(eq(resellerSettings.userId, Number(req.params.userId)))
        .limit(1);
      
      if (settings.length === 0) {
        // Return default settings
        return res.json({
          userId: Number(req.params.userId),
          maxLines: 100,
          maxSubResellers: 0,
          defaultLineDuration: 30,
          defaultMaxConnections: 1,
          allowedBouquets: [],
          creditCostPerLine: 1,
          creditCostPerMonth: 1,
          canCreateTrialLines: false,
          trialLineDuration: 1,
          maxTrialLines: 5,
          customBranding: false,
        });
      }
      res.json(settings[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update reseller settings
  app.put("/api/reseller/settings/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const existing = await db.select()
        .from(resellerSettings)
        .where(eq(resellerSettings.userId, userId))
        .limit(1);
      
      if (existing.length === 0) {
        const [created] = await db.insert(resellerSettings)
          .values({ ...req.body, userId })
          .returning();
        return res.json(created);
      }
      
      const [updated] = await db.update(resellerSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(resellerSettings.userId, userId))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get reseller dashboard stats (for current reseller)
  app.get("/api/reseller/dashboard", requireReseller, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      // Get user's lines
      const userLines = await storage.getLines();
      const myLines = userLines.filter(l => l.memberId === userId);
      
      const now = new Date();
      const activeLines = myLines.filter(l => l.enabled && (!l.expDate || new Date(l.expDate) > now));
      const expiredLines = myLines.filter(l => l.expDate && new Date(l.expDate) <= now);
      const expiringLines = myLines.filter(l => {
        if (!l.expDate) return false;
        const exp = new Date(l.expDate);
        const daysLeft = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysLeft > 0 && daysLeft <= 7;
      });
      
      // Get user's credits
      const user = await storage.getUser(userId);
      
      res.json({
        totalLines: myLines.length,
        activeLines: activeLines.length,
        expiredLines: expiredLines.length,
        expiringLines: expiringLines.length,
        credits: user?.credits || 0,
        maxCredits: user?.maxCredits || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get reseller's lines
  app.get("/api/reseller/lines", requireReseller, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const userLines = await storage.getLines();
      const myLines = userLines.filter(l => l.memberId === userId);
      res.json(myLines);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get reseller's credit transactions
  app.get("/api/reseller/transactions", requireReseller, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const limit = Number(req.query.limit) || 50;
      const transactions = await db.select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, userId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(limit);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get all resellers (admin only)
  app.get("/api/resellers", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getUsers();
      const resellers = users.filter(u => u.role === 'reseller');
      
      // Get settings and line counts for each reseller
      const resellerData = await Promise.all(resellers.map(async (reseller) => {
        const settings = await db.select()
          .from(resellerSettings)
          .where(eq(resellerSettings.userId, reseller.id))
          .limit(1);
        
        const allLines = await storage.getLines();
        const lineCount = allLines.filter(l => l.memberId === reseller.id).length;
        
        return {
          ...reseller,
          password: undefined, // Don't expose password
          settings: settings[0] || null,
          lineCount,
        };
      }));
      
      res.json(resellerData);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get reseller analytics
  app.get("/api/reseller/analytics/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const days = Number(req.query.days) || 30;
      
      const allLines = await storage.getLines();
      const userLines = allLines.filter(l => l.memberId === userId);
      
      // Get credit transactions
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const transactions = await db.select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, since)
        ))
        .orderBy(creditTransactions.createdAt);
      
      const creditsUsed = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const creditsAdded = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      res.json({
        totalLines: userLines.length,
        activeLines: userLines.filter(l => l.enabled).length,
        creditsUsed,
        creditsAdded,
        transactions,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 4: STREAM MONITORING & HEALTH
  // ============================================

  // Get all stream health metrics
  app.get("/api/stream-monitoring/health", requireAdmin, async (_req, res) => {
    try {
      const metrics = await db.select().from(streamHealthMetrics).orderBy(streamHealthMetrics.streamId);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get stream health for specific stream
  app.get("/api/stream-monitoring/health/:streamId", requireAdmin, async (req, res) => {
    try {
      const streamId = Number(req.params.streamId);
      const [metric] = await db.select().from(streamHealthMetrics).where(eq(streamHealthMetrics.streamId, streamId));
      if (!metric) {
        return res.status(404).json({ message: "No health data for this stream" });
      }
      res.json(metric);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update stream health metrics
  app.post("/api/stream-monitoring/health/:streamId", requireAdmin, async (req, res) => {
    try {
      const streamId = Number(req.params.streamId);
      const data = req.body;
      
      const [existing] = await db.select().from(streamHealthMetrics).where(eq(streamHealthMetrics.streamId, streamId));
      
      if (existing) {
        const [updated] = await db.update(streamHealthMetrics)
          .set({ ...data, lastUpdated: new Date() })
          .where(eq(streamHealthMetrics.streamId, streamId))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(streamHealthMetrics)
          .values({ streamId, ...data })
          .returning();
        res.json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get stream monitoring overview
  app.get("/api/stream-monitoring/overview", requireAdmin, async (_req, res) => {
    try {
      const allStreams = await storage.getStreams();
      const allMetrics = await db.select().from(streamHealthMetrics);
      
      const metricsMap = new Map(allMetrics.map(m => [m.streamId, m]));
      
      const online = allMetrics.filter(m => m.status === "online").length;
      const offline = allMetrics.filter(m => m.status === "offline").length;
      const degraded = allMetrics.filter(m => m.status === "degraded").length;
      const errors = allMetrics.filter(m => m.status === "error").length;
      
      const totalViewers = allMetrics.reduce((sum, m) => sum + (m.activeViewers || 0), 0);
      const avgBitrate = allMetrics.filter(m => m.bitrate).reduce((sum, m, _, arr) => sum + (m.bitrate || 0) / arr.length, 0);
      
      res.json({
        totalStreams: allStreams.length,
        monitoredStreams: allMetrics.length,
        online,
        offline,
        degraded,
        errors,
        totalViewers,
        avgBitrate: Math.round(avgBitrate),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Restart a stream
  app.post("/api/stream-monitoring/restart/:streamId", requireAdmin, async (req, res) => {
    try {
      const streamId = Number(req.params.streamId);
      
      // Update restart tracking
      await db.update(streamHealthMetrics)
        .set({ 
          restartCount: sql`${streamHealthMetrics.restartCount} + 1`,
          lastRestart: new Date(),
          status: "restarting"
        })
        .where(eq(streamHealthMetrics.streamId, streamId));
      
      // Log activity
      await storage.createActivityLog({
        userId: (req as any).user?.id || 0,
        action: "stream_restart",
        details: `Restarted stream ${streamId}`,
        ipAddress: req.ip || "",
      });
      
      res.json({ message: "Stream restart initiated", streamId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get stream errors
  app.get("/api/stream-monitoring/errors", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const streamId = req.query.streamId ? Number(req.query.streamId) : undefined;
      
      let query = db.select().from(streamErrors).orderBy(desc(streamErrors.occurredAt)).limit(limit);
      
      if (streamId) {
        query = db.select().from(streamErrors).where(eq(streamErrors.streamId, streamId)).orderBy(desc(streamErrors.occurredAt)).limit(limit);
      }
      
      const errors = await query;
      res.json(errors);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get auto-restart rules
  app.get("/api/stream-monitoring/auto-restart-rules", requireAdmin, async (_req, res) => {
    try {
      const rules = await db.select().from(streamAutoRestartRules);
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create auto-restart rule
  app.post("/api/stream-monitoring/auto-restart-rules", requireAdmin, async (req, res) => {
    try {
      const [rule] = await db.insert(streamAutoRestartRules).values(req.body).returning();
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update auto-restart rule
  app.put("/api/stream-monitoring/auto-restart-rules/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [rule] = await db.update(streamAutoRestartRules).set(req.body).where(eq(streamAutoRestartRules.id, id)).returning();
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete auto-restart rule
  app.delete("/api/stream-monitoring/auto-restart-rules/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(streamAutoRestartRules).where(eq(streamAutoRestartRules.id, id));
      res.json({ message: "Rule deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 4: ENHANCED EPG MANAGEMENT
  // ============================================

  // Get EPG mappings
  app.get("/api/epg/mappings", requireAdmin, async (_req, res) => {
    try {
      const mappings = await db.select().from(epgMappings);
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get EPG mapping for stream
  app.get("/api/epg/mappings/stream/:streamId", requireAdmin, async (req, res) => {
    try {
      const streamId = Number(req.params.streamId);
      const [mapping] = await db.select().from(epgMappings).where(eq(epgMappings.streamId, streamId));
      res.json(mapping || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create EPG mapping
  app.post("/api/epg/mappings", requireAdmin, async (req, res) => {
    try {
      const [mapping] = await db.insert(epgMappings).values(req.body).returning();
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update EPG mapping
  app.put("/api/epg/mappings/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [mapping] = await db.update(epgMappings).set({ ...req.body, updatedAt: new Date() }).where(eq(epgMappings.id, id)).returning();
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete EPG mapping
  app.delete("/api/epg/mappings/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(epgMappings).where(eq(epgMappings.id, id));
      res.json({ message: "Mapping deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Auto-map EPG channels
  app.post("/api/epg/auto-map", requireAdmin, async (req, res) => {
    try {
      const streams = await storage.getStreams();
      const epgChannels = await db.select().from(epgData);
      
      // Get unique EPG channel IDs
      const uniqueChannels = [...new Set(epgChannels.map(e => e.channelId))];
      
      let mapped = 0;
      for (const stream of streams) {
        // Check if already mapped
        const [existing] = await db.select().from(epgMappings).where(eq(epgMappings.streamId, stream.id));
        if (existing) continue;
        
        // Try to find matching EPG channel
        const streamName = stream.streamName?.toLowerCase() || "";
        for (const channelId of uniqueChannels) {
          if (channelId.toLowerCase().includes(streamName) || streamName.includes(channelId.toLowerCase())) {
            await db.insert(epgMappings).values({
              streamId: stream.id,
              epgChannelId: channelId,
              matchType: "auto",
              matchConfidence: 70,
            });
            mapped++;
            break;
          }
        }
      }
      
      res.json({ message: `Auto-mapped ${mapped} streams`, mapped });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get EPG preview for channel
  app.get("/api/epg/preview/:channelId", requireAdmin, async (req, res) => {
    try {
      const channelId = req.params.channelId;
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      const programs = await db.select()
        .from(epgData)
        .where(and(
          eq(epgData.channelId, channelId),
          gte(epgData.startTime, now),
          lte(epgData.endTime, endOfDay)
        ))
        .orderBy(epgData.startTime)
        .limit(50);
      
      res.json(programs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Import EPG from source
  app.post("/api/epg/import/:sourceId", requireAdmin, async (req, res) => {
    try {
      const sourceId = Number(req.params.sourceId);
      const source = await storage.getEpgSource(sourceId);
      
      if (!source) {
        return res.status(404).json({ message: "EPG source not found" });
      }
      
      // In production, this would fetch and parse the EPG XML
      // For now, mark source as updated
      await db.update(epgSources)
        .set({ lastUpdate: new Date() })
        .where(eq(epgSources.id, sourceId));
      
      res.json({ message: "EPG import initiated", sourceId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get EPG statistics
  app.get("/api/epg/stats", requireAdmin, async (_req, res) => {
    try {
      const sources = await storage.getEpgSources();
      const mappings = await db.select().from(epgMappings);
      const streams = await storage.getStreams();
      
      const totalPrograms = await db.select({ count: sql<number>`count(*)` }).from(epgData);
      
      res.json({
        totalSources: sources.length,
        enabledSources: sources.filter(s => s.enabled).length,
        totalMappings: mappings.length,
        totalStreams: streams.length,
        mappedStreams: mappings.length,
        unmappedStreams: streams.length - mappings.length,
        totalPrograms: totalPrograms[0]?.count || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 4: SCHEDULED BACKUPS
  // ============================================

  // Get scheduled backups
  app.get("/api/scheduled-backups", requireAdmin, async (_req, res) => {
    try {
      const schedules = await db.select().from(scheduledBackups).orderBy(scheduledBackups.name);
      res.json(schedules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get scheduled backup by ID
  app.get("/api/scheduled-backups/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [schedule] = await db.select().from(scheduledBackups).where(eq(scheduledBackups.id, id));
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create scheduled backup
  app.post("/api/scheduled-backups", requireAdmin, async (req, res) => {
    try {
      const [schedule] = await db.insert(scheduledBackups).values(req.body).returning();
      res.json(schedule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update scheduled backup
  app.put("/api/scheduled-backups/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [schedule] = await db.update(scheduledBackups).set(req.body).where(eq(scheduledBackups.id, id)).returning();
      res.json(schedule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete scheduled backup
  app.delete("/api/scheduled-backups/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(scheduledBackups).where(eq(scheduledBackups.id, id));
      res.json({ message: "Schedule deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Run scheduled backup now
  app.post("/api/scheduled-backups/:id/run", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [schedule] = await db.select().from(scheduledBackups).where(eq(scheduledBackups.id, id));
      
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Create a backup based on schedule settings
      const backup = await storage.createBackup({
        filename: `scheduled_${schedule.name}_${Date.now()}.zip`,
        size: 0,
        status: "pending",
        type: schedule.backupType || "full",
      });
      
      // Update schedule last run
      await db.update(scheduledBackups)
        .set({ lastRun: new Date(), lastStatus: "running" })
        .where(eq(scheduledBackups.id, id));
      
      res.json({ message: "Backup initiated", backup });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 4: VIEWING ANALYTICS
  // ============================================

  // Get viewing analytics overview
  app.get("/api/viewing-analytics/overview", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const analytics = await db.select()
        .from(viewingAnalytics)
        .where(gte(viewingAnalytics.startTime, since));
      
      const totalViews = analytics.length;
      const totalWatchTime = analytics.reduce((sum, a) => sum + (a.duration || 0), 0);
      const uniqueViewers = new Set(analytics.map(a => a.lineId)).size;
      
      const liveViews = analytics.filter(a => a.contentType === "live").length;
      const vodViews = analytics.filter(a => a.contentType === "vod").length;
      const seriesViews = analytics.filter(a => a.contentType === "series").length;
      
      res.json({
        totalViews,
        totalWatchTime,
        uniqueViewers,
        avgWatchTime: totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0,
        liveViews,
        vodViews,
        seriesViews,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get popular content
  app.get("/api/viewing-analytics/popular", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const limit = Number(req.query.limit) || 20;
      const contentType = req.query.contentType as string;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      let query = db.select({
        contentId: viewingAnalytics.contentId,
        contentType: viewingAnalytics.contentType,
        contentName: viewingAnalytics.contentName,
        views: sql<number>`count(*)`,
        totalWatchTime: sql<number>`sum(${viewingAnalytics.duration})`,
        uniqueViewers: sql<number>`count(distinct ${viewingAnalytics.lineId})`,
      })
        .from(viewingAnalytics)
        .where(gte(viewingAnalytics.startTime, since))
        .groupBy(viewingAnalytics.contentId, viewingAnalytics.contentType, viewingAnalytics.contentName)
        .orderBy(sql`count(*) desc`)
        .limit(limit);
      
      const popular = await query;
      res.json(popular);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get geographic distribution
  app.get("/api/viewing-analytics/geo", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const geoData = await db.select({
        country: viewingAnalytics.country,
        views: sql<number>`count(*)`,
        watchTime: sql<number>`sum(${viewingAnalytics.duration})`,
        uniqueViewers: sql<number>`count(distinct ${viewingAnalytics.lineId})`,
      })
        .from(viewingAnalytics)
        .where(and(
          gte(viewingAnalytics.startTime, since),
          isNotNull(viewingAnalytics.country)
        ))
        .groupBy(viewingAnalytics.country)
        .orderBy(sql`count(*) desc`);
      
      res.json(geoData);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get device distribution
  app.get("/api/viewing-analytics/devices", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const deviceData = await db.select({
        deviceType: viewingAnalytics.deviceType,
        player: viewingAnalytics.player,
        views: sql<number>`count(*)`,
        uniqueViewers: sql<number>`count(distinct ${viewingAnalytics.lineId})`,
      })
        .from(viewingAnalytics)
        .where(gte(viewingAnalytics.startTime, since))
        .groupBy(viewingAnalytics.deviceType, viewingAnalytics.player)
        .orderBy(sql`count(*) desc`);
      
      res.json(deviceData);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get viewer timeline
  app.get("/api/viewing-analytics/timeline", requireAdmin, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const timeline = await db.select({
        date: sql<string>`date_trunc('day', ${viewingAnalytics.startTime})`,
        views: sql<number>`count(*)`,
        watchTime: sql<number>`sum(${viewingAnalytics.duration})`,
        uniqueViewers: sql<number>`count(distinct ${viewingAnalytics.lineId})`,
      })
        .from(viewingAnalytics)
        .where(gte(viewingAnalytics.startTime, since))
        .groupBy(sql`date_trunc('day', ${viewingAnalytics.startTime})`)
        .orderBy(sql`date_trunc('day', ${viewingAnalytics.startTime})`);
      
      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Record viewing analytics (from player API)
  app.post("/api/viewing-analytics/record", async (req, res) => {
    try {
      const [record] = await db.insert(viewingAnalytics).values(req.body).returning();
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get popular content reports
  app.get("/api/viewing-analytics/reports", requireAdmin, async (req, res) => {
    try {
      const reports = await db.select()
        .from(popularContentReports)
        .orderBy(desc(popularContentReports.reportDate))
        .limit(100);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Generate popular content report
  app.post("/api/viewing-analytics/reports/generate", requireAdmin, async (req, res) => {
    try {
      const { periodType = "daily" } = req.body;
      const now = new Date();
      
      // Get analytics for period
      let since: Date;
      switch (periodType) {
        case "hourly":
          since = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "weekly":
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      
      const analytics = await db.select()
        .from(viewingAnalytics)
        .where(gte(viewingAnalytics.startTime, since));
      
      // Aggregate by content
      const contentMap = new Map<string, any>();
      for (const a of analytics) {
        const key = `${a.contentType}_${a.contentId}`;
        if (!contentMap.has(key)) {
          contentMap.set(key, {
            contentType: a.contentType,
            contentId: a.contentId,
            contentName: a.contentName,
            categoryId: a.categoryId,
            views: 0,
            viewers: new Set(),
            watchTime: 0,
            geoDistribution: {} as Record<string, number>,
            deviceDistribution: {} as Record<string, number>,
          });
        }
        const entry = contentMap.get(key);
        entry.views++;
        if (a.lineId) entry.viewers.add(a.lineId);
        entry.watchTime += a.duration || 0;
        if (a.country) entry.geoDistribution[a.country] = (entry.geoDistribution[a.country] || 0) + 1;
        if (a.deviceType) entry.deviceDistribution[a.deviceType] = (entry.deviceDistribution[a.deviceType] || 0) + 1;
      }
      
      // Insert reports
      const reports = [];
      for (const [_, data] of contentMap) {
        const [report] = await db.insert(popularContentReports).values({
          reportDate: now,
          periodType,
          contentType: data.contentType,
          contentId: data.contentId,
          contentName: data.contentName,
          categoryId: data.categoryId,
          totalViews: data.views,
          uniqueViewers: data.viewers.size,
          totalWatchTime: data.watchTime,
          avgWatchTime: data.views > 0 ? Math.round(data.watchTime / data.views) : 0,
          geoDistribution: data.geoDistribution,
          deviceDistribution: data.deviceDistribution,
        }).returning();
        reports.push(report);
      }
      
      res.json({ message: `Generated ${reports.length} reports`, reports: reports.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // BATCH 4: NOTIFICATION SYSTEM
  // ============================================

  // Get notification settings
  app.get("/api/notifications/settings", requireAdmin, async (_req, res) => {
    try {
      let [settings] = await db.select().from(notificationSettings).limit(1);
      if (!settings) {
        [settings] = await db.insert(notificationSettings).values({}).returning();
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update notification settings
  app.put("/api/notifications/settings", requireAdmin, async (req, res) => {
    try {
      let [existing] = await db.select().from(notificationSettings).limit(1);
      
      if (existing) {
        const [settings] = await db.update(notificationSettings)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(notificationSettings.id, existing.id))
          .returning();
        res.json(settings);
      } else {
        const [settings] = await db.insert(notificationSettings).values(req.body).returning();
        res.json(settings);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get notification triggers
  app.get("/api/notifications/triggers", requireAdmin, async (_req, res) => {
    try {
      const triggers = await db.select().from(notificationTriggers).orderBy(notificationTriggers.name);
      res.json(triggers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create notification trigger
  app.post("/api/notifications/triggers", requireAdmin, async (req, res) => {
    try {
      const [trigger] = await db.insert(notificationTriggers).values(req.body).returning();
      res.json(trigger);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update notification trigger
  app.put("/api/notifications/triggers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [trigger] = await db.update(notificationTriggers).set(req.body).where(eq(notificationTriggers.id, id)).returning();
      res.json(trigger);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete notification trigger
  app.delete("/api/notifications/triggers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(notificationTriggers).where(eq(notificationTriggers.id, id));
      res.json({ message: "Trigger deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get notification log
  app.get("/api/notifications/log", requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const channel = req.query.channel as string;
      
      let query = db.select().from(notificationLog).orderBy(desc(notificationLog.createdAt)).limit(limit);
      
      if (channel) {
        query = db.select().from(notificationLog).where(eq(notificationLog.channel, channel)).orderBy(desc(notificationLog.createdAt)).limit(limit);
      }
      
      const logs = await query;
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Test notification
  app.post("/api/notifications/test", requireAdmin, async (req, res) => {
    try {
      const { channel, message = "Test notification from PanelX" } = req.body;
      
      // Get settings
      const [settings] = await db.select().from(notificationSettings).limit(1);
      
      if (!settings) {
        return res.status(400).json({ message: "Notification settings not configured" });
      }
      
      // Log the test
      const [log] = await db.insert(notificationLog).values({
        triggerType: "test",
        triggerName: "Test Notification",
        channel,
        message,
        status: "pending",
      }).returning();
      
      // In production, this would actually send the notification
      // For now, mark as sent
      await db.update(notificationLog)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notificationLog.id, log.id));
      
      res.json({ message: `Test notification sent to ${channel}`, log });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get notification stats
  app.get("/api/notifications/stats", requireAdmin, async (_req, res) => {
    try {
      const allLogs = await db.select().from(notificationLog);
      const triggers = await db.select().from(notificationTriggers);
      
      const sent = allLogs.filter(l => l.status === "sent").length;
      const failed = allLogs.filter(l => l.status === "failed").length;
      const pending = allLogs.filter(l => l.status === "pending").length;
      
      const byChannel = {
        email: allLogs.filter(l => l.channel === "email").length,
        telegram: allLogs.filter(l => l.channel === "telegram").length,
        discord: allLogs.filter(l => l.channel === "discord").length,
        slack: allLogs.filter(l => l.channel === "slack").length,
      };
      
      res.json({
        totalNotifications: allLogs.length,
        sent,
        failed,
        pending,
        activeTriggers: triggers.filter(t => t.enabled).length,
        byChannel,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // GLOBAL ERROR HANDLER (MUST BE LAST)
  // ============================================
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[ERROR]', {
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      body: req.body,
      params: req.params,
      query: req.query,
    });

    // Check if response was already sent
    if (res.headersSent) {
      return next(err);
    }

    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: err.message 
      });
    }

    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (err.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ 
        message: 'Duplicate entry', 
        details: err.detail 
      });
    }

    if (err.code === '23503') { // PostgreSQL foreign key violation
      return res.status(400).json({ 
        message: 'Invalid reference', 
        details: err.detail 
      });
    }

    // Generic error response
    res.status(500).json({ 
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { 
        error: err.message,
        stack: err.stack 
      })
    });
  });

  return httpServer;
}
