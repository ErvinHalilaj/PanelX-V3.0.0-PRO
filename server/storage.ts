import { db } from "./db";
import {
  users, categories, streams, bouquets, lines, activeConnections, activityLog, creditTransactions,
  type InsertUser, type InsertCategory, type InsertStream, type InsertBouquet, type InsertLine,
  type InsertActiveConnection, type InsertActivityLog, type InsertCreditTransaction,
  type User, type Category, type Stream, type Bouquet, type Line, type ActiveConnection, type ActivityLog, type CreditTransaction
} from "@shared/schema";
import { eq, count, and, lt, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  addCredits(userId: number, amount: number, reason: string, referenceId?: number): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Streams
  getStreams(categoryId?: number, type?: string): Promise<Stream[]>;
  getStream(id: number): Promise<Stream | undefined>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStream(id: number, updates: Partial<InsertStream>): Promise<Stream>;
  deleteStream(id: number): Promise<void>;

  // Bouquets
  getBouquets(): Promise<Bouquet[]>;
  getBouquet(id: number): Promise<Bouquet | undefined>;
  createBouquet(bouquet: InsertBouquet): Promise<Bouquet>;
  updateBouquet(id: number, updates: Partial<InsertBouquet>): Promise<Bouquet>;
  deleteBouquet(id: number): Promise<void>;

  // Lines
  getLines(): Promise<Line[]>;
  getLine(id: number): Promise<Line | undefined>;
  getLineByCredentials(username: string, password: string): Promise<Line | undefined>;
  createLine(line: InsertLine): Promise<Line>;
  updateLine(id: number, updates: Partial<InsertLine>): Promise<Line>;
  deleteLine(id: number): Promise<void>;
  extendLine(id: number, days: number): Promise<Line>;

  // Connections
  getActiveConnections(): Promise<ActiveConnection[]>;
  getConnectionsByLine(lineId: number): Promise<ActiveConnection[]>;
  createConnection(connection: InsertActiveConnection): Promise<ActiveConnection>;
  updateConnectionPing(id: number): Promise<void>;
  deleteConnection(id: number): Promise<void>;
  cleanupStaleConnections(): Promise<number>;

  // Activity Log
  getActivityLog(lineId?: number, limit?: number): Promise<ActivityLog[]>;
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;

  // Credit Transactions
  getCreditTransactions(userId?: number): Promise<CreditTransaction[]>;

  // Stats
  getStats(): Promise<{
    totalStreams: number;
    totalLines: number;
    activeConnections: number;
    onlineStreams: number;
    totalUsers: number;
    totalCredits: number;
    expiredLines: number;
    trialLines: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

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

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async addCredits(userId: number, amount: number, reason: string, referenceId?: number): Promise<User> {
    // Update user credits
    const [updatedUser] = await db.update(users)
      .set({ credits: sql`${users.credits} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();

    // Log transaction
    await db.insert(creditTransactions).values({
      userId,
      amount,
      reason,
      referenceId,
    });

    return updatedUser;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Streams
  async getStreams(categoryId?: number, type?: string): Promise<Stream[]> {
    let query = db.select().from(streams);
    if (categoryId) {
      return await db.select().from(streams).where(eq(streams.categoryId, categoryId));
    }
    if (type) {
      return await db.select().from(streams).where(eq(streams.streamType, type));
    }
    return await query;
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

  async getBouquet(id: number): Promise<Bouquet | undefined> {
    const [bouquet] = await db.select().from(bouquets).where(eq(bouquets.id, id));
    return bouquet;
  }

  async createBouquet(bouquet: InsertBouquet): Promise<Bouquet> {
    const [newBouquet] = await db.insert(bouquets).values(bouquet).returning();
    return newBouquet;
  }

  async updateBouquet(id: number, updates: Partial<InsertBouquet>): Promise<Bouquet> {
    const [updated] = await db.update(bouquets).set(updates).where(eq(bouquets.id, id)).returning();
    return updated;
  }

  async deleteBouquet(id: number): Promise<void> {
    await db.delete(bouquets).where(eq(bouquets.id, id));
  }

  // Lines
  async getLines(): Promise<Line[]> {
    return await db.select().from(lines);
  }

  async getLine(id: number): Promise<Line | undefined> {
    const [line] = await db.select().from(lines).where(eq(lines.id, id));
    return line;
  }

  async getLineByCredentials(username: string, password: string): Promise<Line | undefined> {
    const [line] = await db.select().from(lines).where(
      and(eq(lines.username, username), eq(lines.password, password))
    );
    return line;
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

  async extendLine(id: number, days: number): Promise<Line> {
    const line = await this.getLine(id);
    if (!line) throw new Error("Line not found");

    const currentExpDate = line.expDate ? new Date(line.expDate) : new Date();
    const newExpDate = new Date(currentExpDate);
    newExpDate.setDate(newExpDate.getDate() + days);

    const [updated] = await db.update(lines)
      .set({ expDate: newExpDate })
      .where(eq(lines.id, id))
      .returning();
    return updated;
  }

  // Connections
  async getActiveConnections(): Promise<ActiveConnection[]> {
    return await db.select().from(activeConnections);
  }

  async getConnectionsByLine(lineId: number): Promise<ActiveConnection[]> {
    return await db.select().from(activeConnections).where(eq(activeConnections.lineId, lineId));
  }

  async createConnection(connection: InsertActiveConnection): Promise<ActiveConnection> {
    const [newConnection] = await db.insert(activeConnections).values(connection).returning();
    return newConnection;
  }

  async updateConnectionPing(id: number): Promise<void> {
    await db.update(activeConnections)
      .set({ lastPing: new Date() })
      .where(eq(activeConnections.id, id));
  }

  async deleteConnection(id: number): Promise<void> {
    await db.delete(activeConnections).where(eq(activeConnections.id, id));
  }

  async cleanupStaleConnections(): Promise<number> {
    const staleThreshold = new Date(Date.now() - 60000); // 1 minute ago
    const result = await db.delete(activeConnections)
      .where(lt(activeConnections.lastPing, staleThreshold))
      .returning();
    return result.length;
  }

  // Activity Log
  async getActivityLog(lineId?: number, limit: number = 100): Promise<ActivityLog[]> {
    if (lineId) {
      return await db.select().from(activityLog)
        .where(eq(activityLog.lineId, lineId))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);
    }
    return await db.select().from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLog).values(log).returning();
    return newLog;
  }

  // Credit Transactions
  async getCreditTransactions(userId?: number): Promise<CreditTransaction[]> {
    if (userId) {
      return await db.select().from(creditTransactions)
        .where(eq(creditTransactions.userId, userId))
        .orderBy(desc(creditTransactions.createdAt));
    }
    return await db.select().from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt));
  }

  // Stats
  async getStats() {
    const [streamsCount] = await db.select({ count: count() }).from(streams);
    const [linesCount] = await db.select({ count: count() }).from(lines);
    const [connectionsCount] = await db.select({ count: count() }).from(activeConnections);
    const [usersCount] = await db.select({ count: count() }).from(users);
    const [onlineCount] = await db.select({ count: count() }).from(streams).where(eq(streams.monitorStatus, 'online'));
    const [expiredCount] = await db.select({ count: count() }).from(lines).where(lt(lines.expDate, new Date()));
    const [trialCount] = await db.select({ count: count() }).from(lines).where(eq(lines.isTrial, true));
    
    const [creditsSum] = await db.select({ 
      total: sql<number>`COALESCE(SUM(${users.credits}), 0)` 
    }).from(users);

    return {
      totalStreams: streamsCount.count,
      totalLines: linesCount.count,
      activeConnections: connectionsCount.count,
      onlineStreams: onlineCount.count,
      totalUsers: usersCount.count,
      totalCredits: creditsSum.total || 0,
      expiredLines: expiredCount.count,
      trialLines: trialCount.count,
    };
  }
}

export const storage = new DatabaseStorage();
