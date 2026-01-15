import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerPlayerApi } from "./playerApi";

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

  console.log("Database seeded successfully!");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register Xtream Codes compatible API
  registerPlayerApi(app);

  // Seed database on startup
  seedDatabase().catch(console.error);

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

  return httpServer;
}
