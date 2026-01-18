import { db } from "./db";
import {
  users, categories, streams, bouquets, lines, activeConnections, activityLog, creditTransactions,
  servers, epgSources, epgData, series, episodes, vodInfo, tvArchive, blockedIps, blockedUserAgents,
  deviceTemplates, transcodeProfiles, streamErrors, clientLogs, cronJobs, resellerGroups, packages,
  tickets, ticketReplies, backups, webhooks, webhookLogs, settings, accessOutputs, reservedUsernames,
  createdChannels, enigma2Devices, enigma2Actions, signals,
  activationCodes, connectionHistory, mostWatched, twoFactorAuth, fingerprintSettings, lineFingerprints,
  watchFolders, watchFolderLogs, loopingChannels, autoblockRules, statisticsSnapshots, impersonationLogs,
  type InsertUser, type InsertCategory, type InsertStream, type InsertBouquet, type InsertLine,
  type InsertActiveConnection, type InsertActivityLog, type InsertCreditTransaction,
  type InsertServer, type InsertEpgSource, type InsertEpgData, type InsertSeries, type InsertEpisode,
  type InsertVodInfo, type InsertTvArchive, type InsertBlockedIp, type InsertBlockedUserAgent,
  type InsertDeviceTemplate, type InsertTranscodeProfile, type InsertStreamError, type InsertClientLog, type InsertCronJob,
  type InsertResellerGroup, type InsertPackage, type InsertTicket, type InsertTicketReply, type InsertBackup,
  type InsertWebhook, type InsertWebhookLog, type InsertSetting, type InsertAccessOutput, type InsertReservedUsername,
  type InsertCreatedChannel, type InsertEnigma2Device, type InsertEnigma2Action, type InsertSignal,
  type InsertActivationCode, type InsertConnectionHistory, type InsertMostWatched, type InsertTwoFactorAuth,
  type InsertFingerprintSettings, type InsertLineFingerprint, type InsertWatchFolder, type InsertWatchFolderLog,
  type InsertLoopingChannel, type InsertAutoblockRule, type InsertStatisticsSnapshot, type InsertImpersonationLog,
  type User, type Category, type Stream, type Bouquet, type Line, type ActiveConnection, type ActivityLog, type CreditTransaction,
  type Server, type EpgSource, type EpgData, type Series, type Episode, type VodInfo, type TvArchive,
  type BlockedIp, type BlockedUserAgent, type DeviceTemplate, type TranscodeProfile, type StreamError, type ClientLog, type CronJob,
  type ResellerGroup, type Package, type Ticket, type TicketReply, type Backup, type Webhook, type WebhookLog,
  type Setting, type AccessOutput, type ReservedUsername, type CreatedChannel, type Enigma2Device, type Enigma2Action, type Signal,
  type ActivationCode, type ConnectionHistory, type MostWatched, type TwoFactorAuth, type FingerprintSettings, type LineFingerprint,
  type WatchFolder, type WatchFolderLog, type LoopingChannel, type AutoblockRule, type StatisticsSnapshot, type ImpersonationLog
} from "@shared/schema";
import { eq, count, and, lt, sql, desc, gte, lte, or, isNull } from "drizzle-orm";

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

  // Servers
  getServers(): Promise<Server[]>;
  getServer(id: number): Promise<Server | undefined>;
  createServer(server: InsertServer): Promise<Server>;
  updateServer(id: number, updates: Partial<InsertServer>): Promise<Server>;
  deleteServer(id: number): Promise<void>;

  // EPG Sources
  getEpgSources(): Promise<EpgSource[]>;
  getEpgSource(id: number): Promise<EpgSource | undefined>;
  createEpgSource(source: InsertEpgSource): Promise<EpgSource>;
  updateEpgSource(id: number, updates: Partial<InsertEpgSource>): Promise<EpgSource>;
  deleteEpgSource(id: number): Promise<void>;

  // EPG Data
  getEpgData(channelId: string, startTime?: Date, endTime?: Date): Promise<EpgData[]>;
  createEpgData(data: InsertEpgData): Promise<EpgData>;
  clearEpgData(sourceId?: number): Promise<void>;

  // Series
  getSeries(categoryId?: number): Promise<Series[]>;
  getSeriesById(id: number): Promise<Series | undefined>;
  createSeries(s: InsertSeries): Promise<Series>;
  updateSeries(id: number, updates: Partial<InsertSeries>): Promise<Series>;
  deleteSeries(id: number): Promise<void>;

  // Episodes
  getEpisodes(seriesId: number, seasonNum?: number): Promise<Episode[]>;
  getEpisode(id: number): Promise<Episode | undefined>;
  createEpisode(episode: InsertEpisode): Promise<Episode>;
  updateEpisode(id: number, updates: Partial<InsertEpisode>): Promise<Episode>;
  deleteEpisode(id: number): Promise<void>;

  // VOD Info
  getVodInfo(streamId: number): Promise<VodInfo | undefined>;
  createVodInfo(info: InsertVodInfo): Promise<VodInfo>;
  updateVodInfo(id: number, updates: Partial<InsertVodInfo>): Promise<VodInfo>;

  // TV Archive
  getTvArchiveEntries(streamId: number, startTime?: Date, endTime?: Date): Promise<TvArchive[]>;
  createTvArchiveEntry(entry: InsertTvArchive): Promise<TvArchive>;
  deleteTvArchiveEntry(id: number): Promise<void>;

  // Blocked IPs
  getBlockedIps(): Promise<BlockedIp[]>;
  isIpBlocked(ip: string): Promise<boolean>;
  blockIp(ip: InsertBlockedIp): Promise<BlockedIp>;
  unblockIp(id: number): Promise<void>;
  incrementBlockedIpAttempts(ip: string): Promise<void>;

  // Blocked User Agents
  getBlockedUserAgents(): Promise<BlockedUserAgent[]>;
  isUserAgentBlocked(userAgent: string): Promise<boolean>;
  blockUserAgent(ua: InsertBlockedUserAgent): Promise<BlockedUserAgent>;
  unblockUserAgent(id: number): Promise<void>;

  // Device Templates
  getDeviceTemplates(): Promise<DeviceTemplate[]>;
  getDeviceTemplate(key: string): Promise<DeviceTemplate | undefined>;
  createDeviceTemplate(template: InsertDeviceTemplate): Promise<DeviceTemplate>;
  updateDeviceTemplate(id: number, updates: Partial<InsertDeviceTemplate>): Promise<DeviceTemplate>;
  deleteDeviceTemplate(id: number): Promise<void>;

  // Transcode Profiles
  getTranscodeProfiles(): Promise<TranscodeProfile[]>;
  getTranscodeProfile(id: number): Promise<TranscodeProfile | undefined>;
  createTranscodeProfile(profile: InsertTranscodeProfile): Promise<TranscodeProfile>;
  updateTranscodeProfile(id: number, updates: Partial<InsertTranscodeProfile>): Promise<TranscodeProfile>;
  deleteTranscodeProfile(id: number): Promise<void>;

  // Stream Errors
  getStreamErrors(streamId?: number, limit?: number): Promise<StreamError[]>;
  logStreamError(error: InsertStreamError): Promise<StreamError>;
  clearStreamErrors(streamId?: number): Promise<void>;

  // Client Logs
  getClientLogs(lineId?: number, limit?: number): Promise<ClientLog[]>;
  logClient(log: InsertClientLog): Promise<ClientLog>;

  // Cron Jobs
  getCronJobs(): Promise<CronJob[]>;
  getCronJob(id: number): Promise<CronJob | undefined>;
  createCronJob(job: InsertCronJob): Promise<CronJob>;
  updateCronJob(id: number, updates: Partial<InsertCronJob>): Promise<CronJob>;
  deleteCronJob(id: number): Promise<void>;
  getAllEpgData(limit?: number): Promise<EpgData[]>;

  // Reseller Groups
  getResellerGroups(): Promise<ResellerGroup[]>;
  getResellerGroup(id: number): Promise<ResellerGroup | undefined>;
  createResellerGroup(group: InsertResellerGroup): Promise<ResellerGroup>;
  updateResellerGroup(id: number, updates: Partial<InsertResellerGroup>): Promise<ResellerGroup>;
  deleteResellerGroup(id: number): Promise<void>;

  // Packages
  getPackages(): Promise<Package[]>;
  getPackage(id: number): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: number, updates: Partial<InsertPackage>): Promise<Package>;
  deletePackage(id: number): Promise<void>;

  // Bulk Operations
  bulkCreateStreams(streamList: InsertStream[]): Promise<Stream[]>;
  bulkDeleteStreams(ids: number[]): Promise<void>;
  bulkDeleteLines(ids: number[]): Promise<void>;

  // Tickets
  getTickets(userId?: number, status?: string): Promise<Ticket[]>;
  getTicket(id: number): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, updates: Partial<InsertTicket>): Promise<Ticket>;
  deleteTicket(id: number): Promise<void>;
  
  // Ticket Replies
  getTicketReplies(ticketId: number): Promise<TicketReply[]>;
  createTicketReply(reply: InsertTicketReply): Promise<TicketReply>;
  
  // Backups
  getBackups(): Promise<Backup[]>;
  getBackup(id: number): Promise<Backup | undefined>;
  createBackup(backup: InsertBackup): Promise<Backup>;
  updateBackup(id: number, updates: Partial<InsertBackup>): Promise<Backup>;
  deleteBackup(id: number): Promise<void>;
  
  // Webhooks
  getWebhooks(): Promise<Webhook[]>;
  getWebhook(id: number): Promise<Webhook | undefined>;
  getWebhooksByEvent(event: string): Promise<Webhook[]>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook>;
  deleteWebhook(id: number): Promise<void>;
  
  // Webhook Logs
  getWebhookLogs(webhookId?: number, limit?: number): Promise<WebhookLog[]>;
  logWebhook(log: InsertWebhookLog): Promise<WebhookLog>;

  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting>;
  deleteSetting(key: string): Promise<void>;

  // Access Outputs
  getAccessOutputs(): Promise<AccessOutput[]>;
  getAccessOutput(id: number): Promise<AccessOutput | undefined>;
  createAccessOutput(output: InsertAccessOutput): Promise<AccessOutput>;
  updateAccessOutput(id: number, updates: Partial<InsertAccessOutput>): Promise<AccessOutput>;
  deleteAccessOutput(id: number): Promise<void>;

  // Reserved Usernames
  getReservedUsernames(): Promise<ReservedUsername[]>;
  isUsernameReserved(username: string): Promise<boolean>;
  createReservedUsername(reserved: InsertReservedUsername): Promise<ReservedUsername>;
  deleteReservedUsername(id: number): Promise<void>;

  // Created Channels (RTMP to HLS)
  getCreatedChannels(): Promise<CreatedChannel[]>;
  getCreatedChannel(id: number): Promise<CreatedChannel | undefined>;
  createCreatedChannel(channel: InsertCreatedChannel): Promise<CreatedChannel>;
  updateCreatedChannel(id: number, updates: Partial<InsertCreatedChannel>): Promise<CreatedChannel>;
  deleteCreatedChannel(id: number): Promise<void>;

  // Enigma2 Devices
  getEnigma2Devices(): Promise<Enigma2Device[]>;
  getEnigma2Device(id: number): Promise<Enigma2Device | undefined>;
  getEnigma2DeviceByMac(mac: string): Promise<Enigma2Device | undefined>;
  createEnigma2Device(device: InsertEnigma2Device): Promise<Enigma2Device>;
  updateEnigma2Device(id: number, updates: Partial<InsertEnigma2Device>): Promise<Enigma2Device>;
  deleteEnigma2Device(id: number): Promise<void>;

  // Enigma2 Actions
  getEnigma2Actions(deviceId?: number): Promise<Enigma2Action[]>;
  createEnigma2Action(action: InsertEnigma2Action): Promise<Enigma2Action>;
  updateEnigma2Action(id: number, updates: Partial<InsertEnigma2Action>): Promise<Enigma2Action>;
  deleteEnigma2Action(id: number): Promise<void>;

  // Signals (Triggers/Automation)
  getSignals(): Promise<Signal[]>;
  getSignal(id: number): Promise<Signal | undefined>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  updateSignal(id: number, updates: Partial<InsertSignal>): Promise<Signal>;
  deleteSignal(id: number): Promise<void>;

  // Activation Codes
  getActivationCodes(): Promise<ActivationCode[]>;
  getActivationCode(id: number): Promise<ActivationCode | undefined>;
  getActivationCodeByCode(code: string): Promise<ActivationCode | undefined>;
  createActivationCode(code: InsertActivationCode): Promise<ActivationCode>;
  updateActivationCode(id: number, updates: Partial<InsertActivationCode>): Promise<ActivationCode>;
  deleteActivationCode(id: number): Promise<void>;
  redeemActivationCode(code: string, lineId: number): Promise<ActivationCode>;

  // Connection History
  getConnectionHistory(lineId?: number, limit?: number): Promise<ConnectionHistory[]>;
  createConnectionHistory(history: InsertConnectionHistory): Promise<ConnectionHistory>;
  updateConnectionHistory(id: number, updates: Partial<InsertConnectionHistory>): Promise<ConnectionHistory>;

  // Most Watched
  getMostWatched(streamType?: string, limit?: number): Promise<MostWatched[]>;
  updateMostWatched(streamId: number, streamType: string): Promise<MostWatched>;

  // Two-Factor Authentication
  getTwoFactorAuth(userId: number): Promise<TwoFactorAuth | undefined>;
  createTwoFactorAuth(auth: InsertTwoFactorAuth): Promise<TwoFactorAuth>;
  updateTwoFactorAuth(userId: number, updates: Partial<InsertTwoFactorAuth> & { verifiedAt?: Date }): Promise<TwoFactorAuth>;
  deleteTwoFactorAuth(userId: number): Promise<void>;

  // Fingerprint Settings
  getFingerprintSettings(): Promise<FingerprintSettings[]>;
  getFingerprintSetting(id: number): Promise<FingerprintSettings | undefined>;
  createFingerprintSetting(setting: InsertFingerprintSettings): Promise<FingerprintSettings>;
  updateFingerprintSetting(id: number, updates: Partial<InsertFingerprintSettings>): Promise<FingerprintSettings>;
  deleteFingerprintSetting(id: number): Promise<void>;

  // Line Fingerprints
  getLineFingerprints(lineId: number): Promise<LineFingerprint[]>;
  createLineFingerprint(fingerprint: InsertLineFingerprint): Promise<LineFingerprint>;
  deleteLineFingerprint(id: number): Promise<void>;

  // Watch Folders
  getWatchFolders(): Promise<WatchFolder[]>;
  getWatchFolder(id: number): Promise<WatchFolder | undefined>;
  createWatchFolder(folder: InsertWatchFolder): Promise<WatchFolder>;
  updateWatchFolder(id: number, updates: Partial<InsertWatchFolder>): Promise<WatchFolder>;
  deleteWatchFolder(id: number): Promise<void>;

  // Watch Folder Logs
  getWatchFolderLogs(folderId?: number): Promise<WatchFolderLog[]>;
  createWatchFolderLog(log: InsertWatchFolderLog): Promise<WatchFolderLog>;
  updateWatchFolderLog(id: number, updates: Partial<InsertWatchFolderLog>): Promise<WatchFolderLog>;

  // Looping Channels
  getLoopingChannels(): Promise<LoopingChannel[]>;
  getLoopingChannel(id: number): Promise<LoopingChannel | undefined>;
  createLoopingChannel(channel: InsertLoopingChannel): Promise<LoopingChannel>;
  updateLoopingChannel(id: number, updates: Partial<InsertLoopingChannel>): Promise<LoopingChannel>;
  deleteLoopingChannel(id: number): Promise<void>;

  // Autoblock Rules
  getAutoblockRules(): Promise<AutoblockRule[]>;
  getAutoblockRule(id: number): Promise<AutoblockRule | undefined>;
  createAutoblockRule(rule: InsertAutoblockRule): Promise<AutoblockRule>;
  updateAutoblockRule(id: number, updates: Partial<InsertAutoblockRule>): Promise<AutoblockRule>;
  deleteAutoblockRule(id: number): Promise<void>;

  // Statistics Snapshots
  getStatisticsSnapshots(type?: string, limit?: number): Promise<StatisticsSnapshot[]>;
  createStatisticsSnapshot(snapshot: InsertStatisticsSnapshot): Promise<StatisticsSnapshot>;

  // Impersonation Logs
  getImpersonationLogs(adminId?: number): Promise<ImpersonationLog[]>;
  createImpersonationLog(log: InsertImpersonationLog): Promise<ImpersonationLog>;
  endImpersonation(id: number): Promise<ImpersonationLog>;
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
    const [newStream] = await db.insert(streams).values(stream as any).returning();
    return newStream;
  }

  async updateStream(id: number, updates: Partial<InsertStream>): Promise<Stream> {
    const [updated] = await db.update(streams).set(updates as any).where(eq(streams.id, id)).returning();
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
    const [newBouquet] = await db.insert(bouquets).values(bouquet as any).returning();
    return newBouquet;
  }

  async updateBouquet(id: number, updates: Partial<InsertBouquet>): Promise<Bouquet> {
    const [updated] = await db.update(bouquets).set(updates as any).where(eq(bouquets.id, id)).returning();
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
    const [newLine] = await db.insert(lines).values(line as any).returning();
    return newLine;
  }

  async updateLine(id: number, updates: Partial<InsertLine>): Promise<Line> {
    const [updated] = await db.update(lines).set(updates as any).where(eq(lines.id, id)).returning();
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

  // Servers
  async getServers(): Promise<Server[]> {
    return await db.select().from(servers);
  }

  async getServer(id: number): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    return server;
  }

  async createServer(server: InsertServer): Promise<Server> {
    const [newServer] = await db.insert(servers).values(server).returning();
    return newServer;
  }

  async updateServer(id: number, updates: Partial<InsertServer>): Promise<Server> {
    const [updated] = await db.update(servers).set(updates).where(eq(servers.id, id)).returning();
    return updated;
  }

  async deleteServer(id: number): Promise<void> {
    await db.delete(servers).where(eq(servers.id, id));
  }

  // EPG Sources
  async getEpgSources(): Promise<EpgSource[]> {
    return await db.select().from(epgSources);
  }

  async getEpgSource(id: number): Promise<EpgSource | undefined> {
    const [source] = await db.select().from(epgSources).where(eq(epgSources.id, id));
    return source;
  }

  async createEpgSource(source: InsertEpgSource): Promise<EpgSource> {
    const [newSource] = await db.insert(epgSources).values(source).returning();
    return newSource;
  }

  async updateEpgSource(id: number, updates: Partial<InsertEpgSource>): Promise<EpgSource> {
    const [updated] = await db.update(epgSources).set(updates).where(eq(epgSources.id, id)).returning();
    return updated;
  }

  async deleteEpgSource(id: number): Promise<void> {
    await db.delete(epgSources).where(eq(epgSources.id, id));
  }

  // EPG Data
  async getEpgData(channelId: string, startTime?: Date, endTime?: Date): Promise<EpgData[]> {
    let conditions = [eq(epgData.channelId, channelId)];
    if (startTime) conditions.push(gte(epgData.startTime, startTime));
    if (endTime) conditions.push(lte(epgData.endTime, endTime));
    return await db.select().from(epgData).where(and(...conditions));
  }

  async createEpgData(data: InsertEpgData): Promise<EpgData> {
    const [newData] = await db.insert(epgData).values(data).returning();
    return newData;
  }

  async clearEpgData(sourceId?: number): Promise<void> {
    if (sourceId) {
      await db.delete(epgData).where(eq(epgData.sourceId, sourceId));
    } else {
      await db.delete(epgData);
    }
  }

  // Series
  async getSeries(categoryId?: number): Promise<Series[]> {
    if (categoryId) {
      return await db.select().from(series).where(eq(series.categoryId, categoryId));
    }
    return await db.select().from(series);
  }

  async getSeriesById(id: number): Promise<Series | undefined> {
    const [s] = await db.select().from(series).where(eq(series.id, id));
    return s;
  }

  async createSeries(s: InsertSeries): Promise<Series> {
    const [newSeries] = await db.insert(series).values(s).returning();
    return newSeries;
  }

  async updateSeries(id: number, updates: Partial<InsertSeries>): Promise<Series> {
    const [updated] = await db.update(series).set(updates).where(eq(series.id, id)).returning();
    return updated;
  }

  async deleteSeries(id: number): Promise<void> {
    await db.delete(episodes).where(eq(episodes.seriesId, id));
    await db.delete(series).where(eq(series.id, id));
  }

  // Episodes
  async getEpisodes(seriesId: number, seasonNum?: number): Promise<Episode[]> {
    if (seasonNum !== undefined) {
      return await db.select().from(episodes).where(
        and(eq(episodes.seriesId, seriesId), eq(episodes.seasonNum, seasonNum))
      );
    }
    return await db.select().from(episodes).where(eq(episodes.seriesId, seriesId));
  }

  async getEpisode(id: number): Promise<Episode | undefined> {
    const [episode] = await db.select().from(episodes).where(eq(episodes.id, id));
    return episode;
  }

  async createEpisode(episode: InsertEpisode): Promise<Episode> {
    const [newEpisode] = await db.insert(episodes).values(episode).returning();
    return newEpisode;
  }

  async updateEpisode(id: number, updates: Partial<InsertEpisode>): Promise<Episode> {
    const [updated] = await db.update(episodes).set(updates).where(eq(episodes.id, id)).returning();
    return updated;
  }

  async deleteEpisode(id: number): Promise<void> {
    await db.delete(episodes).where(eq(episodes.id, id));
  }

  // VOD Info
  async getVodInfo(streamId: number): Promise<VodInfo | undefined> {
    const [info] = await db.select().from(vodInfo).where(eq(vodInfo.streamId, streamId));
    return info;
  }

  async createVodInfo(info: InsertVodInfo): Promise<VodInfo> {
    const [newInfo] = await db.insert(vodInfo).values(info as any).returning();
    return newInfo;
  }

  async updateVodInfo(id: number, updates: Partial<InsertVodInfo>): Promise<VodInfo> {
    const [updated] = await db.update(vodInfo).set(updates as any).where(eq(vodInfo.id, id)).returning();
    return updated;
  }

  // TV Archive
  async getTvArchiveEntries(streamId: number, startTime?: Date, endTime?: Date): Promise<TvArchive[]> {
    let conditions = [eq(tvArchive.streamId, streamId)];
    if (startTime) conditions.push(gte(tvArchive.startTime, startTime));
    if (endTime) conditions.push(lte(tvArchive.endTime, endTime));
    return await db.select().from(tvArchive).where(and(...conditions));
  }

  async createTvArchiveEntry(entry: InsertTvArchive): Promise<TvArchive> {
    const [newEntry] = await db.insert(tvArchive).values(entry).returning();
    return newEntry;
  }

  async deleteTvArchiveEntry(id: number): Promise<void> {
    await db.delete(tvArchive).where(eq(tvArchive.id, id));
  }

  // Blocked IPs
  async getBlockedIps(): Promise<BlockedIp[]> {
    return await db.select().from(blockedIps);
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    const [blocked] = await db.select().from(blockedIps).where(
      and(
        eq(blockedIps.ipAddress, ip),
        or(isNull(blockedIps.expiresAt), gte(blockedIps.expiresAt, new Date()))
      )
    );
    return !!blocked;
  }

  async blockIp(ip: InsertBlockedIp): Promise<BlockedIp> {
    const [newBlock] = await db.insert(blockedIps).values(ip).returning();
    return newBlock;
  }

  async unblockIp(id: number): Promise<void> {
    await db.delete(blockedIps).where(eq(blockedIps.id, id));
  }

  async incrementBlockedIpAttempts(ip: string): Promise<void> {
    await db.update(blockedIps)
      .set({ attemptsBlocked: sql`${blockedIps.attemptsBlocked} + 1` })
      .where(eq(blockedIps.ipAddress, ip));
  }

  // Blocked User Agents
  async getBlockedUserAgents(): Promise<BlockedUserAgent[]> {
    return await db.select().from(blockedUserAgents);
  }

  async isUserAgentBlocked(userAgent: string): Promise<boolean> {
    const agents = await db.select().from(blockedUserAgents);
    for (const agent of agents) {
      if (agent.exactMatch) {
        if (userAgent === agent.userAgent) return true;
      } else {
        if (userAgent.toLowerCase().includes(agent.userAgent.toLowerCase())) return true;
      }
    }
    return false;
  }

  async blockUserAgent(ua: InsertBlockedUserAgent): Promise<BlockedUserAgent> {
    const [newBlock] = await db.insert(blockedUserAgents).values(ua).returning();
    return newBlock;
  }

  async unblockUserAgent(id: number): Promise<void> {
    await db.delete(blockedUserAgents).where(eq(blockedUserAgents.id, id));
  }

  // Device Templates
  async getDeviceTemplates(): Promise<DeviceTemplate[]> {
    return await db.select().from(deviceTemplates);
  }

  async getDeviceTemplate(key: string): Promise<DeviceTemplate | undefined> {
    const [template] = await db.select().from(deviceTemplates).where(eq(deviceTemplates.deviceKey, key));
    return template;
  }

  async createDeviceTemplate(template: InsertDeviceTemplate): Promise<DeviceTemplate> {
    const [newTemplate] = await db.insert(deviceTemplates).values(template).returning();
    return newTemplate;
  }

  async updateDeviceTemplate(id: number, updates: Partial<InsertDeviceTemplate>): Promise<DeviceTemplate> {
    const [updated] = await db.update(deviceTemplates).set(updates).where(eq(deviceTemplates.id, id)).returning();
    return updated;
  }

  async deleteDeviceTemplate(id: number): Promise<void> {
    await db.delete(deviceTemplates).where(eq(deviceTemplates.id, id));
  }

  // Transcode Profiles
  async getTranscodeProfiles(): Promise<TranscodeProfile[]> {
    return await db.select().from(transcodeProfiles);
  }

  async getTranscodeProfile(id: number): Promise<TranscodeProfile | undefined> {
    const [profile] = await db.select().from(transcodeProfiles).where(eq(transcodeProfiles.id, id));
    return profile;
  }

  async createTranscodeProfile(profile: InsertTranscodeProfile): Promise<TranscodeProfile> {
    const [newProfile] = await db.insert(transcodeProfiles).values(profile).returning();
    return newProfile;
  }

  async updateTranscodeProfile(id: number, updates: Partial<InsertTranscodeProfile>): Promise<TranscodeProfile> {
    const [updated] = await db.update(transcodeProfiles).set(updates).where(eq(transcodeProfiles.id, id)).returning();
    return updated;
  }

  async deleteTranscodeProfile(id: number): Promise<void> {
    await db.delete(transcodeProfiles).where(eq(transcodeProfiles.id, id));
  }

  // Stream Errors
  async getStreamErrors(streamId?: number, limit: number = 100): Promise<StreamError[]> {
    if (streamId) {
      return await db.select().from(streamErrors)
        .where(eq(streamErrors.streamId, streamId))
        .orderBy(desc(streamErrors.occurredAt))
        .limit(limit);
    }
    return await db.select().from(streamErrors)
      .orderBy(desc(streamErrors.occurredAt))
      .limit(limit);
  }

  async logStreamError(error: InsertStreamError): Promise<StreamError> {
    const [newError] = await db.insert(streamErrors).values(error).returning();
    return newError;
  }

  async clearStreamErrors(streamId?: number): Promise<void> {
    if (streamId) {
      await db.delete(streamErrors).where(eq(streamErrors.streamId, streamId));
    } else {
      await db.delete(streamErrors);
    }
  }

  // Client Logs
  async getClientLogs(lineId?: number, limit: number = 100): Promise<ClientLog[]> {
    if (lineId) {
      return await db.select().from(clientLogs)
        .where(eq(clientLogs.lineId, lineId))
        .orderBy(desc(clientLogs.createdAt))
        .limit(limit);
    }
    return await db.select().from(clientLogs)
      .orderBy(desc(clientLogs.createdAt))
      .limit(limit);
  }

  async logClient(log: InsertClientLog): Promise<ClientLog> {
    const [newLog] = await db.insert(clientLogs).values(log).returning();
    return newLog;
  }

  // Cron Jobs
  async getCronJobs(): Promise<CronJob[]> {
    return await db.select().from(cronJobs);
  }

  async getCronJob(id: number): Promise<CronJob | undefined> {
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, id));
    return job;
  }

  async createCronJob(job: InsertCronJob): Promise<CronJob> {
    const [newJob] = await db.insert(cronJobs).values(job).returning();
    return newJob;
  }

  async updateCronJob(id: number, updates: Partial<InsertCronJob>): Promise<CronJob> {
    const [updated] = await db.update(cronJobs).set(updates).where(eq(cronJobs.id, id)).returning();
    return updated;
  }

  async deleteCronJob(id: number): Promise<void> {
    await db.delete(cronJobs).where(eq(cronJobs.id, id));
  }

  // Get all EPG Data
  async getAllEpgData(limit: number = 100): Promise<EpgData[]> {
    return await db.select().from(epgData).orderBy(desc(epgData.startTime)).limit(limit);
  }

  // Reseller Groups
  async getResellerGroups(): Promise<ResellerGroup[]> {
    return await db.select().from(resellerGroups);
  }

  async getResellerGroup(id: number): Promise<ResellerGroup | undefined> {
    const [group] = await db.select().from(resellerGroups).where(eq(resellerGroups.id, id));
    return group;
  }

  async createResellerGroup(group: InsertResellerGroup): Promise<ResellerGroup> {
    const [newGroup] = await db.insert(resellerGroups).values(group as any).returning();
    return newGroup;
  }

  async updateResellerGroup(id: number, updates: Partial<InsertResellerGroup>): Promise<ResellerGroup> {
    const [updated] = await db.update(resellerGroups).set(updates as any).where(eq(resellerGroups.id, id)).returning();
    return updated;
  }

  async deleteResellerGroup(id: number): Promise<void> {
    await db.delete(resellerGroups).where(eq(resellerGroups.id, id));
  }

  // Packages
  async getPackages(): Promise<Package[]> {
    return await db.select().from(packages);
  }

  async getPackage(id: number): Promise<Package | undefined> {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, id));
    return pkg;
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    const [newPkg] = await db.insert(packages).values(pkg as any).returning();
    return newPkg;
  }

  async updatePackage(id: number, updates: Partial<InsertPackage>): Promise<Package> {
    const [updated] = await db.update(packages).set(updates as any).where(eq(packages.id, id)).returning();
    return updated;
  }

  async deletePackage(id: number): Promise<void> {
    await db.delete(packages).where(eq(packages.id, id));
  }

  // Bulk Operations
  async bulkCreateStreams(streamList: InsertStream[]): Promise<Stream[]> {
    if (streamList.length === 0) return [];
    const newStreams = await db.insert(streams).values(streamList as any).returning();
    return newStreams;
  }

  async bulkDeleteStreams(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(streams).where(sql`${streams.id} = ANY(${ids})`);
  }

  async bulkDeleteLines(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(lines).where(sql`${lines.id} = ANY(${ids})`);
  }

  // Tickets
  async getTickets(userId?: number, status?: string): Promise<Ticket[]> {
    const conditions = [];
    if (userId) conditions.push(eq(tickets.userId, userId));
    if (status) conditions.push(eq(tickets.status, status));
    
    if (conditions.length > 0) {
      return await db.select().from(tickets).where(and(...conditions)).orderBy(desc(tickets.createdAt));
    }
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [newTicket] = await db.insert(tickets).values(ticket).returning();
    return newTicket;
  }

  async updateTicket(id: number, updates: Partial<InsertTicket>): Promise<Ticket> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.status === 'closed') {
      updateData.closedAt = new Date();
    }
    const [updated] = await db.update(tickets).set(updateData).where(eq(tickets.id, id)).returning();
    return updated;
  }

  async deleteTicket(id: number): Promise<void> {
    await db.delete(ticketReplies).where(eq(ticketReplies.ticketId, id));
    await db.delete(tickets).where(eq(tickets.id, id));
  }

  // Ticket Replies
  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    return await db.select().from(ticketReplies).where(eq(ticketReplies.ticketId, ticketId)).orderBy(ticketReplies.createdAt);
  }

  async createTicketReply(reply: InsertTicketReply): Promise<TicketReply> {
    const [newReply] = await db.insert(ticketReplies).values(reply).returning();
    // Update ticket's updatedAt
    if (reply.ticketId) {
      await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, reply.ticketId));
    }
    return newReply;
  }

  // Backups
  async getBackups(): Promise<Backup[]> {
    return await db.select().from(backups).orderBy(desc(backups.createdAt));
  }

  async getBackup(id: number): Promise<Backup | undefined> {
    const [backup] = await db.select().from(backups).where(eq(backups.id, id));
    return backup;
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    const [newBackup] = await db.insert(backups).values(backup as any).returning();
    return newBackup;
  }

  async updateBackup(id: number, updates: Partial<InsertBackup>): Promise<Backup> {
    const [updated] = await db.update(backups).set(updates as any).where(eq(backups.id, id)).returning();
    return updated;
  }

  async deleteBackup(id: number): Promise<void> {
    await db.delete(backups).where(eq(backups.id, id));
  }

  // Webhooks
  async getWebhooks(): Promise<Webhook[]> {
    return await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
  }

  async getWebhook(id: number): Promise<Webhook | undefined> {
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return webhook;
  }

  async getWebhooksByEvent(event: string): Promise<Webhook[]> {
    const allWebhooks = await db.select().from(webhooks).where(eq(webhooks.enabled, true));
    return allWebhooks.filter(wh => {
      const events = wh.events as string[] || [];
      return events.includes(event) || events.includes('*');
    });
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [newWebhook] = await db.insert(webhooks).values(webhook as any).returning();
    return newWebhook;
  }

  async updateWebhook(id: number, updates: Partial<InsertWebhook>): Promise<Webhook> {
    const [updated] = await db.update(webhooks).set(updates as any).where(eq(webhooks.id, id)).returning();
    return updated;
  }

  async deleteWebhook(id: number): Promise<void> {
    await db.delete(webhookLogs).where(eq(webhookLogs.webhookId, id));
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  // Webhook Logs
  async getWebhookLogs(webhookId?: number, limit: number = 100): Promise<WebhookLog[]> {
    if (webhookId) {
      return await db.select().from(webhookLogs)
        .where(eq(webhookLogs.webhookId, webhookId))
        .orderBy(desc(webhookLogs.createdAt))
        .limit(limit);
    }
    return await db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(limit);
  }

  async logWebhook(log: InsertWebhookLog): Promise<WebhookLog> {
    const [newLog] = await db.insert(webhookLogs).values(log).returning();
    return newLog;
  }

  // Settings
  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.settingKey, key));
    return setting;
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    const [newSetting] = await db.insert(settings).values(setting).returning();
    return newSetting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const [updated] = await db.update(settings)
      .set({ settingValue: value })
      .where(eq(settings.settingKey, key))
      .returning();
    return updated;
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.settingKey, key));
  }

  // Access Outputs
  async getAccessOutputs(): Promise<AccessOutput[]> {
    return await db.select().from(accessOutputs);
  }

  async getAccessOutput(id: number): Promise<AccessOutput | undefined> {
    const [output] = await db.select().from(accessOutputs).where(eq(accessOutputs.id, id));
    return output;
  }

  async createAccessOutput(output: InsertAccessOutput): Promise<AccessOutput> {
    const [newOutput] = await db.insert(accessOutputs).values(output).returning();
    return newOutput;
  }

  async updateAccessOutput(id: number, updates: Partial<InsertAccessOutput>): Promise<AccessOutput> {
    const [updated] = await db.update(accessOutputs).set(updates).where(eq(accessOutputs.id, id)).returning();
    return updated;
  }

  async deleteAccessOutput(id: number): Promise<void> {
    await db.delete(accessOutputs).where(eq(accessOutputs.id, id));
  }

  // Reserved Usernames
  async getReservedUsernames(): Promise<ReservedUsername[]> {
    return await db.select().from(reservedUsernames);
  }

  async isUsernameReserved(username: string): Promise<boolean> {
    const [reserved] = await db.select().from(reservedUsernames)
      .where(eq(reservedUsernames.username, username.toLowerCase()));
    return !!reserved;
  }

  async createReservedUsername(reserved: InsertReservedUsername): Promise<ReservedUsername> {
    const [newReserved] = await db.insert(reservedUsernames)
      .values({ ...reserved, username: reserved.username.toLowerCase() })
      .returning();
    return newReserved;
  }

  async deleteReservedUsername(id: number): Promise<void> {
    await db.delete(reservedUsernames).where(eq(reservedUsernames.id, id));
  }

  // Created Channels (RTMP to HLS)
  async getCreatedChannels(): Promise<CreatedChannel[]> {
    return await db.select().from(createdChannels);
  }

  async getCreatedChannel(id: number): Promise<CreatedChannel | undefined> {
    const [channel] = await db.select().from(createdChannels).where(eq(createdChannels.id, id));
    return channel;
  }

  async createCreatedChannel(channel: InsertCreatedChannel): Promise<CreatedChannel> {
    const [newChannel] = await db.insert(createdChannels).values(channel).returning();
    return newChannel;
  }

  async updateCreatedChannel(id: number, updates: Partial<InsertCreatedChannel>): Promise<CreatedChannel> {
    const [updated] = await db.update(createdChannels).set(updates).where(eq(createdChannels.id, id)).returning();
    return updated;
  }

  async deleteCreatedChannel(id: number): Promise<void> {
    await db.delete(createdChannels).where(eq(createdChannels.id, id));
  }

  // Enigma2 Devices
  async getEnigma2Devices(): Promise<Enigma2Device[]> {
    return await db.select().from(enigma2Devices);
  }

  async getEnigma2Device(id: number): Promise<Enigma2Device | undefined> {
    const [device] = await db.select().from(enigma2Devices).where(eq(enigma2Devices.id, id));
    return device;
  }

  async getEnigma2DeviceByMac(mac: string): Promise<Enigma2Device | undefined> {
    const [device] = await db.select().from(enigma2Devices).where(eq(enigma2Devices.mac, mac));
    return device;
  }

  async createEnigma2Device(device: InsertEnigma2Device): Promise<Enigma2Device> {
    const [newDevice] = await db.insert(enigma2Devices).values(device).returning();
    return newDevice;
  }

  async updateEnigma2Device(id: number, updates: Partial<InsertEnigma2Device>): Promise<Enigma2Device> {
    const [updated] = await db.update(enigma2Devices).set(updates).where(eq(enigma2Devices.id, id)).returning();
    return updated;
  }

  async deleteEnigma2Device(id: number): Promise<void> {
    await db.delete(enigma2Devices).where(eq(enigma2Devices.id, id));
  }

  // Enigma2 Actions
  async getEnigma2Actions(deviceId?: number): Promise<Enigma2Action[]> {
    if (deviceId) {
      return await db.select().from(enigma2Actions).where(eq(enigma2Actions.deviceId, deviceId)).orderBy(desc(enigma2Actions.createdAt));
    }
    return await db.select().from(enigma2Actions).orderBy(desc(enigma2Actions.createdAt));
  }

  async createEnigma2Action(action: InsertEnigma2Action): Promise<Enigma2Action> {
    const [newAction] = await db.insert(enigma2Actions).values(action).returning();
    return newAction;
  }

  async updateEnigma2Action(id: number, updates: Partial<InsertEnigma2Action>): Promise<Enigma2Action> {
    const [updated] = await db.update(enigma2Actions).set(updates).where(eq(enigma2Actions.id, id)).returning();
    return updated;
  }

  async deleteEnigma2Action(id: number): Promise<void> {
    await db.delete(enigma2Actions).where(eq(enigma2Actions.id, id));
  }

  // Signals (Triggers/Automation)
  async getSignals(): Promise<Signal[]> {
    return await db.select().from(signals);
  }

  async getSignal(id: number): Promise<Signal | undefined> {
    const [signal] = await db.select().from(signals).where(eq(signals.id, id));
    return signal;
  }

  async createSignal(signal: InsertSignal): Promise<Signal> {
    const [newSignal] = await db.insert(signals).values(signal).returning();
    return newSignal;
  }

  async updateSignal(id: number, updates: Partial<InsertSignal>): Promise<Signal> {
    const [updated] = await db.update(signals).set(updates).where(eq(signals.id, id)).returning();
    return updated;
  }

  async deleteSignal(id: number): Promise<void> {
    await db.delete(signals).where(eq(signals.id, id));
  }

  // Activation Codes
  async getActivationCodes(): Promise<ActivationCode[]> {
    return await db.select().from(activationCodes).orderBy(desc(activationCodes.createdAt));
  }

  async getActivationCode(id: number): Promise<ActivationCode | undefined> {
    const [code] = await db.select().from(activationCodes).where(eq(activationCodes.id, id));
    return code;
  }

  async getActivationCodeByCode(code: string): Promise<ActivationCode | undefined> {
    const [result] = await db.select().from(activationCodes).where(eq(activationCodes.code, code));
    return result;
  }

  async createActivationCode(code: InsertActivationCode): Promise<ActivationCode> {
    const [newCode] = await db.insert(activationCodes).values(code).returning();
    return newCode;
  }

  async updateActivationCode(id: number, updates: Partial<InsertActivationCode>): Promise<ActivationCode> {
    const [updated] = await db.update(activationCodes).set(updates).where(eq(activationCodes.id, id)).returning();
    return updated;
  }

  async deleteActivationCode(id: number): Promise<void> {
    await db.delete(activationCodes).where(eq(activationCodes.id, id));
  }

  async redeemActivationCode(code: string, lineId: number): Promise<ActivationCode> {
    const [updated] = await db.update(activationCodes)
      .set({ usedBy: lineId, usedAt: new Date(), enabled: false })
      .where(eq(activationCodes.code, code))
      .returning();
    return updated;
  }

  // Connection History
  async getConnectionHistory(lineId?: number, limit?: number): Promise<ConnectionHistory[]> {
    let query = db.select().from(connectionHistory).orderBy(desc(connectionHistory.startedAt));
    if (lineId) {
      query = query.where(eq(connectionHistory.lineId, lineId)) as typeof query;
    }
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }

  async createConnectionHistory(history: InsertConnectionHistory): Promise<ConnectionHistory> {
    const [newHistory] = await db.insert(connectionHistory).values(history).returning();
    return newHistory;
  }

  async updateConnectionHistory(id: number, updates: Partial<InsertConnectionHistory>): Promise<ConnectionHistory> {
    const [updated] = await db.update(connectionHistory).set(updates).where(eq(connectionHistory.id, id)).returning();
    return updated;
  }

  // Most Watched
  async getMostWatched(streamType?: string, limit?: number): Promise<MostWatched[]> {
    let query = db.select().from(mostWatched).orderBy(desc(mostWatched.totalViews));
    if (streamType) {
      query = query.where(eq(mostWatched.streamType, streamType)) as typeof query;
    }
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }

  async updateMostWatched(streamId: number, streamType: string): Promise<MostWatched> {
    const [existing] = await db.select().from(mostWatched).where(eq(mostWatched.streamId, streamId));
    if (existing) {
      const [updated] = await db.update(mostWatched)
        .set({ 
          totalViews: sql`${mostWatched.totalViews} + 1`,
          lastWatched: new Date()
        })
        .where(eq(mostWatched.streamId, streamId))
        .returning();
      return updated;
    }
    const [newEntry] = await db.insert(mostWatched)
      .values({ streamId, streamType, totalViews: 1, lastWatched: new Date() })
      .returning();
    return newEntry;
  }

  // Two-Factor Authentication
  async getTwoFactorAuth(userId: number): Promise<TwoFactorAuth | undefined> {
    const [auth] = await db.select().from(twoFactorAuth).where(eq(twoFactorAuth.userId, userId));
    return auth;
  }

  async createTwoFactorAuth(auth: InsertTwoFactorAuth): Promise<TwoFactorAuth> {
    const [newAuth] = await db.insert(twoFactorAuth).values(auth).returning();
    return newAuth;
  }

  async updateTwoFactorAuth(userId: number, updates: Partial<InsertTwoFactorAuth> & { verifiedAt?: Date }): Promise<TwoFactorAuth> {
    const [updated] = await db.update(twoFactorAuth).set(updates).where(eq(twoFactorAuth.userId, userId)).returning();
    return updated;
  }

  async deleteTwoFactorAuth(userId: number): Promise<void> {
    await db.delete(twoFactorAuth).where(eq(twoFactorAuth.userId, userId));
  }

  // Fingerprint Settings
  async getFingerprintSettings(): Promise<FingerprintSettings[]> {
    return await db.select().from(fingerprintSettings);
  }

  async getFingerprintSetting(id: number): Promise<FingerprintSettings | undefined> {
    const [setting] = await db.select().from(fingerprintSettings).where(eq(fingerprintSettings.id, id));
    return setting;
  }

  async createFingerprintSetting(setting: InsertFingerprintSettings): Promise<FingerprintSettings> {
    const [newSetting] = await db.insert(fingerprintSettings).values(setting).returning();
    return newSetting;
  }

  async updateFingerprintSetting(id: number, updates: Partial<InsertFingerprintSettings>): Promise<FingerprintSettings> {
    const [updated] = await db.update(fingerprintSettings).set(updates).where(eq(fingerprintSettings.id, id)).returning();
    return updated;
  }

  async deleteFingerprintSetting(id: number): Promise<void> {
    await db.delete(fingerprintSettings).where(eq(fingerprintSettings.id, id));
  }

  // Line Fingerprints
  async getLineFingerprints(lineId: number): Promise<LineFingerprint[]> {
    return await db.select().from(lineFingerprints).where(eq(lineFingerprints.lineId, lineId));
  }

  async createLineFingerprint(fingerprint: InsertLineFingerprint): Promise<LineFingerprint> {
    const [newFingerprint] = await db.insert(lineFingerprints).values(fingerprint).returning();
    return newFingerprint;
  }

  async deleteLineFingerprint(id: number): Promise<void> {
    await db.delete(lineFingerprints).where(eq(lineFingerprints.id, id));
  }

  // Watch Folders
  async getWatchFolders(): Promise<WatchFolder[]> {
    return await db.select().from(watchFolders);
  }

  async getWatchFolder(id: number): Promise<WatchFolder | undefined> {
    const [folder] = await db.select().from(watchFolders).where(eq(watchFolders.id, id));
    return folder;
  }

  async createWatchFolder(folder: InsertWatchFolder): Promise<WatchFolder> {
    const [newFolder] = await db.insert(watchFolders).values(folder).returning();
    return newFolder;
  }

  async updateWatchFolder(id: number, updates: Partial<InsertWatchFolder>): Promise<WatchFolder> {
    const [updated] = await db.update(watchFolders).set(updates).where(eq(watchFolders.id, id)).returning();
    return updated;
  }

  async deleteWatchFolder(id: number): Promise<void> {
    await db.delete(watchFolders).where(eq(watchFolders.id, id));
  }

  // Watch Folder Logs
  async getWatchFolderLogs(folderId?: number): Promise<WatchFolderLog[]> {
    if (folderId) {
      return await db.select().from(watchFolderLogs).where(eq(watchFolderLogs.watchFolderId, folderId)).orderBy(desc(watchFolderLogs.createdAt));
    }
    return await db.select().from(watchFolderLogs).orderBy(desc(watchFolderLogs.createdAt));
  }

  async createWatchFolderLog(log: InsertWatchFolderLog): Promise<WatchFolderLog> {
    const [newLog] = await db.insert(watchFolderLogs).values(log).returning();
    return newLog;
  }

  async updateWatchFolderLog(id: number, updates: Partial<InsertWatchFolderLog>): Promise<WatchFolderLog> {
    const [updated] = await db.update(watchFolderLogs).set(updates).where(eq(watchFolderLogs.id, id)).returning();
    return updated;
  }

  // Looping Channels (24/7 Channels)
  async getLoopingChannels(): Promise<LoopingChannel[]> {
    return await db.select().from(loopingChannels);
  }

  async getLoopingChannel(id: number): Promise<LoopingChannel | undefined> {
    const [channel] = await db.select().from(loopingChannels).where(eq(loopingChannels.id, id));
    return channel;
  }

  async createLoopingChannel(channel: InsertLoopingChannel): Promise<LoopingChannel> {
    const [newChannel] = await db.insert(loopingChannels).values(channel).returning();
    return newChannel;
  }

  async updateLoopingChannel(id: number, updates: Partial<InsertLoopingChannel>): Promise<LoopingChannel> {
    const [updated] = await db.update(loopingChannels).set(updates).where(eq(loopingChannels.id, id)).returning();
    return updated;
  }

  async deleteLoopingChannel(id: number): Promise<void> {
    await db.delete(loopingChannels).where(eq(loopingChannels.id, id));
  }

  // Autoblock Rules
  async getAutoblockRules(): Promise<AutoblockRule[]> {
    return await db.select().from(autoblockRules);
  }

  async getAutoblockRule(id: number): Promise<AutoblockRule | undefined> {
    const [rule] = await db.select().from(autoblockRules).where(eq(autoblockRules.id, id));
    return rule;
  }

  async createAutoblockRule(rule: InsertAutoblockRule): Promise<AutoblockRule> {
    const [newRule] = await db.insert(autoblockRules).values(rule).returning();
    return newRule;
  }

  async updateAutoblockRule(id: number, updates: Partial<InsertAutoblockRule>): Promise<AutoblockRule> {
    const [updated] = await db.update(autoblockRules).set(updates).where(eq(autoblockRules.id, id)).returning();
    return updated;
  }

  async deleteAutoblockRule(id: number): Promise<void> {
    await db.delete(autoblockRules).where(eq(autoblockRules.id, id));
  }

  // Statistics Snapshots
  async getStatisticsSnapshots(type?: string, limit?: number): Promise<StatisticsSnapshot[]> {
    let query = db.select().from(statisticsSnapshots).orderBy(desc(statisticsSnapshots.recordedAt));
    if (type) {
      query = query.where(eq(statisticsSnapshots.snapshotType, type)) as typeof query;
    }
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }

  async createStatisticsSnapshot(snapshot: InsertStatisticsSnapshot): Promise<StatisticsSnapshot> {
    const [newSnapshot] = await db.insert(statisticsSnapshots).values(snapshot).returning();
    return newSnapshot;
  }

  // Impersonation Logs
  async getImpersonationLogs(adminId?: number): Promise<ImpersonationLog[]> {
    if (adminId) {
      return await db.select().from(impersonationLogs).where(eq(impersonationLogs.adminId, adminId)).orderBy(desc(impersonationLogs.startedAt));
    }
    return await db.select().from(impersonationLogs).orderBy(desc(impersonationLogs.startedAt));
  }

  async createImpersonationLog(log: InsertImpersonationLog): Promise<ImpersonationLog> {
    const [newLog] = await db.insert(impersonationLogs).values(log).returning();
    return newLog;
  }

  async endImpersonation(id: number): Promise<ImpersonationLog> {
    const [updated] = await db.update(impersonationLogs)
      .set({ endedAt: new Date() })
      .where(eq(impersonationLogs.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
