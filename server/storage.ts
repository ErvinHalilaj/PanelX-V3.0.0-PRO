import { db } from "./db";
import {
  users, categories, streams, bouquets, lines,
  type InsertUser, type InsertCategory, type InsertStream, type InsertBouquet, type InsertLine,
  type User, type Category, type Stream, type Bouquet, type Line
} from "@shared/schema";
import { eq, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Streams
  getStreams(categoryId?: number): Promise<Stream[]>;
  getStream(id: number): Promise<Stream | undefined>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStream(id: number, updates: Partial<InsertStream>): Promise<Stream>;
  deleteStream(id: number): Promise<void>;

  // Bouquets
  getBouquets(): Promise<Bouquet[]>;
  createBouquet(bouquet: InsertBouquet): Promise<Bouquet>;

  // Lines
  getLines(): Promise<Line[]>;
  createLine(line: InsertLine): Promise<Line>;
  updateLine(id: number, updates: Partial<InsertLine>): Promise<Line>;
  deleteLine(id: number): Promise<void>;

  // Stats
  getStats(): Promise<{
    totalStreams: number;
    totalLines: number;
    activeConnections: number;
    onlineStreams: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Streams
  async getStreams(categoryId?: number): Promise<Stream[]> {
    if (categoryId) {
      return await db.select().from(streams).where(eq(streams.categoryId, categoryId));
    }
    return await db.select().from(streams);
  }

  async getStream(id: number): Promise<Stream | undefined> {
    const [stream] = await db.select().from(streams).where(eq(streams.id, id));
    return stream;
  }

  async createStream(stream: InsertStream): Promise<Stream> {
    const [newStream] = await db.insert(streams).values(stream).returning();
    return newStream;
  }

  async updateStream(id: number, updates: Partial<InsertStream>): Promise<Stream> {
    const [updated] = await db.update(streams).set(updates).where(eq(streams.id, id)).returning();
    return updated;
  }

  async deleteStream(id: number): Promise<void> {
    await db.delete(streams).where(eq(streams.id, id));
  }

  // Bouquets
  async getBouquets(): Promise<Bouquet[]> {
    return await db.select().from(bouquets);
  }

  async createBouquet(bouquet: InsertBouquet): Promise<Bouquet> {
    const [newBouquet] = await db.insert(bouquets).values(bouquet).returning();
    return newBouquet;
  }

  // Lines
  async getLines(): Promise<Line[]> {
    return await db.select().from(lines);
  }

  async createLine(line: InsertLine): Promise<Line> {
    const [newLine] = await db.insert(lines).values(line).returning();
    return newLine;
  }

  async updateLine(id: number, updates: Partial<InsertLine>): Promise<Line> {
    const [updated] = await db.update(lines).set(updates).where(eq(lines.id, id)).returning();
    return updated;
  }

  async deleteLine(id: number): Promise<void> {
    await db.delete(lines).where(eq(lines.id, id));
  }

  // Stats
  async getStats() {
    // These are partially mocked for now until we have real monitoring tables
    const [streamsCount] = await db.select({ count: count() }).from(streams);
    const [linesCount] = await db.select({ count: count() }).from(lines);
    
    return {
      totalStreams: streamsCount.count,
      totalLines: linesCount.count,
      activeConnections: 0, // Mocked - needs real-time tracking table
      onlineStreams: Math.floor(streamsCount.count * 0.8), // Mock 80% uptime
    };
  }
}

export const storage = new DatabaseStorage();
