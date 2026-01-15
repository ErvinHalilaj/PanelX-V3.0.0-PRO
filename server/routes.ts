import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === STATS ===
  app.get(api.stats.get.path, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
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

  app.delete(api.categories.delete.path, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  // === STREAMS ===
  app.get(api.streams.list.path, async (req, res) => {
    // Handles optional categoryId query param
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const streams = await storage.getStreams(categoryId);
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

  // === BOUQUETS ===
  app.get(api.bouquets.list.path, async (_req, res) => {
    const bouquets = await storage.getBouquets();
    res.json(bouquets);
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

  // === LINES ===
  app.get(api.lines.list.path, async (_req, res) => {
    const lines = await storage.getLines();
    res.json(lines);
  });

  app.post(api.lines.create.path, async (req, res) => {
    try {
      const input = api.lines.create.input.parse(req.body);
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

  // === SEED DATA ===
  await seed();

  return httpServer;
}

async function seed() {
  const categories = await storage.getCategories();
  if (categories.length === 0) {
    const live = await storage.createCategory({ categoryName: "Live TV", categoryType: "live" });
    const movies = await storage.createCategory({ categoryName: "Movies", categoryType: "movie" });
    
    await storage.createStream({
      name: "Test Stream 1",
      sourceUrl: "http://example.com/stream.m3u8",
      categoryId: live.id,
      streamType: "live",
      isDirect: true,
      notes: "Sample stream"
    });

    await storage.createBouquet({
      bouquetName: "Basic Package",
      bouquetChannels: [],
      bouquetSeries: []
    });

    await storage.createLine({
      username: "testuser",
      password: "password123",
      maxConnections: 1,
      isTrial: true,
      enabled: true,
    });
  }
}
