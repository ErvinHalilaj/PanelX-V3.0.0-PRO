import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Admins and Resellers
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("admin"), // admin, reseller
  credits: integer("credits").default(0),
  notes: text("notes"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Streaming Servers (Multi-server support)
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  serverName: text("server_name").notNull(),
  serverUrl: text("server_url").notNull(),
  serverPort: integer("server_port").default(80),
  rtmpPort: integer("rtmp_port").default(1935),
  httpBroadcastPort: integer("http_broadcast_port").default(25461),
  isMainServer: boolean("is_main_server").default(false),
  status: text("status").default("offline"), // online, offline
  maxClients: integer("max_clients").default(1000),
  currentClients: integer("current_clients").default(0),
  cpuUsage: real("cpu_usage").default(0),
  memoryUsage: real("memory_usage").default(0),
  bandwidth: real("bandwidth").default(0),
  lastChecked: timestamp("last_checked"),
  enabled: boolean("enabled").default(true),
  geoZone: text("geo_zone"), // For geo-routing
  createdAt: timestamp("created_at").defaultNow(),
});

// EPG Sources
export const epgSources = pgTable("epg_sources", {
  id: serial("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  lastUpdate: timestamp("last_update"),
  updateInterval: integer("update_interval").default(24), // hours
  enabled: boolean("enabled").default(true),
});

// EPG Data
export const epgData = pgTable("epg_data", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  lang: text("lang").default("en"),
  category: text("category"),
  sourceId: integer("source_id").references(() => epgSources.id),
});

// Series (TV Shows)
export const series = pgTable("series", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  cover: text("cover"),
  backdrop: text("backdrop"),
  plot: text("plot"),
  cast: text("cast"),
  director: text("director"),
  genre: text("genre"),
  releaseDate: text("release_date"),
  rating: text("rating"),
  youtubeTrailer: text("youtube_trailer"),
  tmdbId: text("tmdb_id"),
  lastModified: timestamp("last_modified").defaultNow(),
});

// Series Episodes
export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").references(() => series.id).notNull(),
  seasonNum: integer("season_num").notNull(),
  episodeNum: integer("episode_num").notNull(),
  title: text("title"),
  plot: text("plot"),
  duration: integer("duration"), // seconds
  sourceUrl: text("source_url").notNull(),
  cover: text("cover"),
  releaseDate: text("release_date"),
  addedAt: timestamp("added_at").defaultNow(),
});

// VOD/Movie Metadata
export const vodInfo = pgTable("vod_info", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => streams.id).notNull(),
  tmdbId: text("tmdb_id"),
  imdbId: text("imdb_id"),
  plot: text("plot"),
  cast: text("cast"),
  director: text("director"),
  genre: text("genre"),
  releaseDate: text("release_date"),
  duration: integer("duration"), // seconds
  rating: text("rating"),
  backdrop: text("backdrop"),
  youtubeTrailer: text("youtube_trailer"),
  subtitles: jsonb("subtitles").$type<{lang: string, url: string}[]>().default([]),
});

// TV Archive Entries
export const tvArchive = pgTable("tv_archive", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => streams.id).notNull(),
  serverId: integer("server_id").references(() => servers.id),
  archiveFile: text("archive_file").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration"), // seconds
  fileSize: integer("file_size"), // bytes
});

// Blocked IPs
export const blockedIps = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason"),
  blockedAt: timestamp("blocked_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  attemptsBlocked: integer("attempts_blocked").default(0),
  autoBlocked: boolean("auto_blocked").default(false),
});

// Blocked User Agents
export const blockedUserAgents = pgTable("blocked_user_agents", {
  id: serial("id").primaryKey(),
  userAgent: text("user_agent").notNull(),
  exactMatch: boolean("exact_match").default(false),
  attemptsBlocked: integer("attempts_blocked").default(0),
});

// Device Templates (for playlist generation)
export const deviceTemplates = pgTable("device_templates", {
  id: serial("id").primaryKey(),
  deviceName: text("device_name").notNull(),
  deviceKey: text("device_key").notNull().unique(),
  fileExtension: text("file_extension").notNull(),
  headerTemplate: text("header_template"),
  lineTemplate: text("line_template").notNull(),
  footerTemplate: text("footer_template"),
  defaultOutput: text("default_output").default("ts"),
});

// Transcode Profiles
export const transcodeProfiles = pgTable("transcode_profiles", {
  id: serial("id").primaryKey(),
  profileName: text("profile_name").notNull(),
  videoCodec: text("video_codec").default("copy"), // copy, h264, h265
  audioCodec: text("audio_codec").default("copy"), // copy, aac
  videoBitrate: text("video_bitrate"), // e.g., "4000k"
  audioBitrate: text("audio_bitrate"), // e.g., "128k"
  resolution: text("resolution"), // e.g., "1920x1080"
  preset: text("preset").default("fast"), // ultrafast, fast, medium, slow
  customParams: text("custom_params"), // Additional FFmpeg params
  enabled: boolean("enabled").default(true),
});

// Stream Errors Log
export const streamErrors = pgTable("stream_errors", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => streams.id),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message"),
  serverId: integer("server_id").references(() => servers.id),
  occurredAt: timestamp("occurred_at").defaultNow(),
});

// Client Logs (detailed connection logs)
export const clientLogs = pgTable("client_logs", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => lines.id),
  streamId: integer("stream_id").references(() => streams.id),
  clientStatus: text("client_status").notNull(), // connect, disconnect, error
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  bytesTransferred: integer("bytes_transferred").default(0),
  duration: integer("duration").default(0), // seconds
  country: text("country"),
  isp: text("isp"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cron Jobs
export const cronJobs = pgTable("cron_jobs", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(),
  description: text("description"),
  intervalMinutes: integer("interval_minutes").default(60),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  enabled: boolean("enabled").default(true),
  status: text("status").default("idle"), // idle, running, error
});

// Content Categories (e.g., "Sports", "Movies")
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  categoryName: text("category_name").notNull(),
  categoryType: text("category_type").default("live"), // live, movie, series
  parentId: integer("parent_id"),
});

// Live Streams and VODs
export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  streamType: text("stream_type").default("live"), // live, movie, created_live
  sourceUrl: text("source_url").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  transcodeProfileId: integer("transcode_profile_id").references(() => transcodeProfiles.id),
  serverId: integer("server_id").references(() => servers.id),
  streamIcon: text("stream_icon"),
  epgChannelId: text("epg_channel_id"),
  notes: text("notes"),
  isDirect: boolean("is_direct").default(false),
  isMonitored: boolean("is_monitored").default(true),
  monitorStatus: text("monitor_status").default("unknown"), // online, offline, unknown
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
  // TV Archive settings
  tvArchiveEnabled: boolean("tv_archive_enabled").default(false),
  tvArchiveDuration: integer("tv_archive_duration").default(0), // days
  tvArchiveServerId: integer("tv_archive_server_id").references(() => servers.id),
  // Auto-restart settings
  autoRestart: boolean("auto_restart").default(true),
  restartAttempts: integer("restart_attempts").default(0),
  lastRestartAt: timestamp("last_restart_at"),
});

// Bouquets (Packages of streams)
export const bouquets = pgTable("bouquets", {
  id: serial("id").primaryKey(),
  bouquetName: text("bouquet_name").notNull(),
  bouquetChannels: jsonb("bouquet_channels").$type<number[]>().default([]),
  bouquetMovies: jsonb("bouquet_movies").$type<number[]>().default([]),
  bouquetSeries: jsonb("bouquet_series").$type<number[]>().default([]),
});

// Lines (The end-user subscriptions)
export const lines = pgTable("lines", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  memberId: integer("member_id").references(() => users.id),
  expDate: timestamp("exp_date"),
  adminNotes: text("admin_notes"),
  resellerNotes: text("reseller_notes"),
  maxConnections: integer("max_connections").default(1),
  isTrial: boolean("is_trial").default(false),
  bouquets: jsonb("bouquets").$type<number[]>().default([]),
  allowedOutputs: jsonb("allowed_outputs").$type<string[]>().default(["m3u8", "ts"]),
  createdAt: timestamp("created_at").defaultNow(),
  enabled: boolean("enabled").default(true),
  lastActivity: timestamp("last_activity"),
  // Device Locking
  forcedCountry: text("forced_country"),
  allowedIps: jsonb("allowed_ips").$type<string[]>().default([]),
  lockedDeviceId: text("locked_device_id"),
  lockedMac: text("locked_mac"),
  // GeoIP restrictions
  allowedCountries: jsonb("allowed_countries").$type<string[]>().default([]),
});

// Active Connections (Real-time tracking)
export const activeConnections = pgTable("active_connections", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => lines.id),
  streamId: integer("stream_id").references(() => streams.id),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  startedAt: timestamp("started_at").defaultNow(),
  lastPing: timestamp("last_ping").defaultNow(),
});

// Activity Log (For analytics and audit)
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => lines.id),
  action: text("action").notNull(), // auth_success, auth_fail, stream_start, stream_stop
  streamId: integer("stream_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Credit Transactions (For reseller billing)
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  amount: integer("amount").notNull(), // positive = add, negative = deduct
  reason: text("reason").notNull(), // line_create, line_extend, admin_add, admin_remove
  referenceId: integer("reference_id"), // e.g., line ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Server Settings
export const serverSettings = pgTable("server_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
});

// === RELATIONS ===
export const streamsRelations = relations(streams, ({ one }) => ({
  category: one(categories, {
    fields: [streams.categoryId],
    references: [categories.id],
  }),
}));

export const linesRelations = relations(lines, ({ one, many }) => ({
  owner: one(users, {
    fields: [lines.memberId],
    references: [users.id],
  }),
  connections: many(activeConnections),
}));

export const activeConnectionsRelations = relations(activeConnections, ({ one }) => ({
  line: one(lines, {
    fields: [activeConnections.lineId],
    references: [lines.id],
  }),
  stream: one(streams, {
    fields: [activeConnections.streamId],
    references: [streams.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertStreamSchema = createInsertSchema(streams).omit({ id: true, createdAt: true, lastChecked: true, lastRestartAt: true });
export const insertBouquetSchema = createInsertSchema(bouquets).omit({ id: true });
export const insertLineSchema = createInsertSchema(lines).omit({ id: true, createdAt: true, lastActivity: true });
export const insertActiveConnectionSchema = createInsertSchema(activeConnections).omit({ id: true, startedAt: true, lastPing: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });

// New schemas for additional features
export const insertServerSchema = createInsertSchema(servers).omit({ id: true, createdAt: true, lastChecked: true });
export const insertEpgSourceSchema = createInsertSchema(epgSources).omit({ id: true, lastUpdate: true });
export const insertEpgDataSchema = createInsertSchema(epgData).omit({ id: true });
export const insertSeriesSchema = createInsertSchema(series).omit({ id: true, lastModified: true });
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ id: true, addedAt: true });
export const insertVodInfoSchema = createInsertSchema(vodInfo).omit({ id: true });
export const insertTvArchiveSchema = createInsertSchema(tvArchive).omit({ id: true });
export const insertBlockedIpSchema = createInsertSchema(blockedIps).omit({ id: true, blockedAt: true, attemptsBlocked: true });
export const insertBlockedUserAgentSchema = createInsertSchema(blockedUserAgents).omit({ id: true, attemptsBlocked: true });
export const insertDeviceTemplateSchema = createInsertSchema(deviceTemplates).omit({ id: true });
export const insertTranscodeProfileSchema = createInsertSchema(transcodeProfiles).omit({ id: true });
export const insertStreamErrorSchema = createInsertSchema(streamErrors).omit({ id: true, occurredAt: true });
export const insertClientLogSchema = createInsertSchema(clientLogs).omit({ id: true, createdAt: true });
export const insertCronJobSchema = createInsertSchema(cronJobs).omit({ id: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Stream = typeof streams.$inferSelect;
export type InsertStream = z.infer<typeof insertStreamSchema>;

export type Bouquet = typeof bouquets.$inferSelect;
export type InsertBouquet = z.infer<typeof insertBouquetSchema>;

export type Line = typeof lines.$inferSelect;
export type InsertLine = z.infer<typeof insertLineSchema>;

export type ActiveConnection = typeof activeConnections.$inferSelect;
export type InsertActiveConnection = z.infer<typeof insertActiveConnectionSchema>;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

// New types for additional features
export type Server = typeof servers.$inferSelect;
export type InsertServer = z.infer<typeof insertServerSchema>;

export type EpgSource = typeof epgSources.$inferSelect;
export type InsertEpgSource = z.infer<typeof insertEpgSourceSchema>;

export type EpgData = typeof epgData.$inferSelect;
export type InsertEpgData = z.infer<typeof insertEpgDataSchema>;

export type Series = typeof series.$inferSelect;
export type InsertSeries = z.infer<typeof insertSeriesSchema>;

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;

export type VodInfo = typeof vodInfo.$inferSelect;
export type InsertVodInfo = z.infer<typeof insertVodInfoSchema>;

export type TvArchive = typeof tvArchive.$inferSelect;
export type InsertTvArchive = z.infer<typeof insertTvArchiveSchema>;

export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = z.infer<typeof insertBlockedIpSchema>;

export type BlockedUserAgent = typeof blockedUserAgents.$inferSelect;
export type InsertBlockedUserAgent = z.infer<typeof insertBlockedUserAgentSchema>;

export type DeviceTemplate = typeof deviceTemplates.$inferSelect;
export type InsertDeviceTemplate = z.infer<typeof insertDeviceTemplateSchema>;

export type TranscodeProfile = typeof transcodeProfiles.$inferSelect;
export type InsertTranscodeProfile = z.infer<typeof insertTranscodeProfileSchema>;

export type StreamError = typeof streamErrors.$inferSelect;
export type InsertStreamError = z.infer<typeof insertStreamErrorSchema>;

export type ClientLog = typeof clientLogs.$inferSelect;
export type InsertClientLog = z.infer<typeof insertClientLogSchema>;

export type CronJob = typeof cronJobs.$inferSelect;
export type InsertCronJob = z.infer<typeof insertCronJobSchema>;

// Request Types
export type CreateStreamRequest = InsertStream;
export type UpdateStreamRequest = Partial<InsertStream>;
export type CreateLineRequest = InsertLine;
export type UpdateLineRequest = Partial<InsertLine>;
export type CreateUserRequest = InsertUser;
export type UpdateUserRequest = Partial<InsertUser>;

// Xtream Codes API Types
export interface XtreamUserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}
