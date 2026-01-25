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
  // Two-Factor Authentication
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorBackupCodes: jsonb("two_factor_backup_codes"), // Array of hashed backup codes
  lastTwoFactorCheck: timestamp("last_two_factor_check"),
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
  // SSH Access for Load Balancing
  sshHost: text("ssh_host"), // IP or hostname for SSH
  sshPort: integer("ssh_port").default(22),
  sshUsername: text("ssh_username").default("root"),
  sshPassword: text("ssh_password"), // Should be encrypted in production
  sshPrivateKey: text("ssh_private_key"), // Alternative to password
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

// Stream Schedules (Auto start/stop)
export const streamSchedules = pgTable("stream_schedules", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => streams.id).notNull(),
  scheduleType: text("schedule_type").notNull(), // once, daily, weekly, custom
  startTime: text("start_time"), // HH:MM format
  stopTime: text("stop_time"), // HH:MM format
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  daysOfWeek: text("days_of_week"), // JSON array of 0-6 (Sunday-Saturday)
  timezone: text("timezone").default("UTC"),
  enabled: boolean("enabled").default(true),
  action: text("action").notNull(), // start, stop, both
  cronExpression: text("cron_expression"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Backups (System backup management)
export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  backupName: text("backup_name").notNull(),
  description: text("description"),
  backupType: text("backup_type").default("full"), // full, settings, users, streams
  status: text("status").default("pending"), // pending, in_progress, completed, failed
  fileSize: integer("file_size").default(0), // bytes
  filePath: text("file_path"),
  includedTables: jsonb("included_tables").$type<string[]>().default([]),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// Webhooks (Event notifications)
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"), // For signing payloads
  events: jsonb("events").$type<string[]>().default([]), // line.created, line.expired, stream.offline, etc.
  enabled: boolean("enabled").default(true),
  retries: integer("retries").default(3),
  timeoutSeconds: integer("timeout_seconds").default(30),
  lastTriggered: timestamp("last_triggered"),
  lastStatus: integer("last_status"), // HTTP status code
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook Logs
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").references(() => webhooks.id),
  event: text("event").notNull(),
  payload: jsonb("payload"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  success: boolean("success").default(false),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Support Tickets (admin-reseller communication)
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Reseller who created ticket
  subject: text("subject").notNull(),
  status: text("status").default("open"), // open, pending, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  category: text("category").default("general"), // general, billing, technical, account
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

// Ticket Replies
export const ticketReplies = pgTable("ticket_replies", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id),
  userId: integer("user_id").references(() => users.id), // Who replied
  message: text("message").notNull(),
  isAdminReply: boolean("is_admin_reply").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// System Settings (Global panel configuration)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
  settingType: text("setting_type").default("text"), // text, number, boolean, json
  category: text("category").default("general"), // general, security, streaming, api
  description: text("description"),
});

// Access Output Types (HLS, MPEGTS, RTMP)
export const accessOutputs = pgTable("access_outputs", {
  id: serial("id").primaryKey(),
  outputName: text("output_name").notNull(), // HLS, MPEGTS, RTMP
  outputKey: text("output_key").notNull().unique(), // m3u8, ts, rtmp
  outputExt: text("output_ext").default(""), // m3u8, ts, "" (empty for RTMP)
  enabled: boolean("enabled").default(true),
});

// Reserved Usernames (blocked from registration)
export const reservedUsernames = pgTable("reserved_usernames", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Created Channels (RTMP to HLS live transcoding)
export const createdChannels = pgTable("created_channels", {
  id: serial("id").primaryKey(),
  channelName: text("channel_name").notNull(),
  categoryId: integer("category_id"),
  streamIcon: text("stream_icon"),
  notes: text("notes"),
  rtmpSource: text("rtmp_source"), // RTMP input URL
  hlsOutput: text("hls_output"), // HLS output path
  transcodeEnabled: boolean("transcode_enabled").default(true),
  transcodeProfileId: integer("transcode_profile_id"),
  customFfmpeg: text("custom_ffmpeg"),
  readNative: boolean("read_native").default(false),
  streamAll: boolean("stream_all").default(false),
  removeSubtitles: boolean("remove_subtitles").default(false),
  genTimestamps: boolean("gen_timestamps").default(false),
  epgChannelId: text("epg_channel_id"),
  epgLang: text("epg_lang").default("en"),
  channelOrder: integer("channel_order").default(0),
  autoRestart: boolean("auto_restart").default(true),
  allowRecord: boolean("allow_record").default(false),
  delayMinutes: integer("delay_minutes").default(0),
  rtmpOutput: boolean("rtmp_output").default(false),
  externalPush: text("external_push"), // Push to external CDN
  directSource: boolean("direct_source").default(false),
  tvArchiveDuration: integer("tv_archive_duration").default(0),
  tvArchiveServerId: integer("tv_archive_server_id"),
  pid: integer("pid").default(0), // Process ID when running
  status: text("status").default("stopped"), // stopped, running, error
  addedAt: timestamp("added_at").defaultNow(),
});

// Enigma2 Devices (STB device management)
export const enigma2Devices = pgTable("enigma2_devices", {
  id: serial("id").primaryKey(),
  mac: text("mac").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  modemMac: text("modem_mac"),
  localIp: text("local_ip"),
  publicIp: text("public_ip"),
  keyAuth: text("key_auth"),
  enigmaVersion: text("enigma_version"),
  cpu: text("cpu"),
  deviceVersion: text("device_version"),
  token: text("token"),
  lastUpdated: timestamp("last_updated"),
  watchdogTimeout: integer("watchdog_timeout").default(0),
  lockDevice: boolean("lock_device").default(false),
  telnetEnabled: boolean("telnet_enabled").default(true),
  ftpEnabled: boolean("ftp_enabled").default(true),
  sshEnabled: boolean("ssh_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enigma2 Actions (remote commands for devices)
export const enigma2Actions = pgTable("enigma2_actions", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => enigma2Devices.id),
  actionType: text("action_type").notNull(), // reboot, message, channel, volume, etc.
  actionKey: text("action_key").notNull(),
  command: text("command"),
  command2: text("command2"),
  status: text("status").default("pending"), // pending, sent, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Signals (triggers/automation for events)
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  signalName: text("signal_name").notNull(),
  signalType: text("signal_type").notNull(), // stream_down, user_expired, connection_limit, etc.
  triggerCondition: text("trigger_condition"), // JSON condition
  actionType: text("action_type").notNull(), // email, webhook, restart_stream, block_ip
  actionConfig: jsonb("action_config"), // Action configuration
  enabled: boolean("enabled").default(true),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
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
  // Multiple backup source URLs for failover
  backupUrls: jsonb("backup_urls").$type<string[]>().default([]),
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
  // Advanced stream options
  onDemand: boolean("on_demand").default(false), // Stream sleeps when not in use
  autoRestartHours: integer("auto_restart_hours").default(0), // Restart after X hours (0 = disabled)
  delayMinutes: integer("delay_minutes").default(0), // Timeshift delay
  rtmpOutput: text("rtmp_output"), // Push to RTMP destination
  externalPush: text("external_push"), // Push to external CDN
  customFfmpeg: text("custom_ffmpeg"), // Custom FFmpeg mapping
  readNative: boolean("read_native").default(false),
  streamAll: boolean("stream_all").default(false),
  removeSubtitles: boolean("remove_subtitles").default(false),
  genTimestamps: boolean("gen_timestamps").default(false),
  probesizeOndemand: integer("probesize_ondemand").default(0),
  allowRecord: boolean("allow_record").default(true),
  customSid: text("custom_sid"), // Custom service ID
  streamOrder: integer("stream_order").default(0), // Display order
});

// Bouquets (Packages of streams)
export const bouquets = pgTable("bouquets", {
  id: serial("id").primaryKey(),
  bouquetName: text("bouquet_name").notNull(),
  bouquetChannels: jsonb("bouquet_channels").$type<number[]>().default([]),
  bouquetMovies: jsonb("bouquet_movies").$type<number[]>().default([]),
  bouquetSeries: jsonb("bouquet_series").$type<number[]>().default([]),
});

// Reseller Groups (Permission groups)
export const resellerGroups = pgTable("reseller_groups", {
  id: serial("id").primaryKey(),
  groupName: text("group_name").notNull(),
  canDeleteLines: boolean("can_delete_lines").default(true),
  canEditLines: boolean("can_edit_lines").default(true),
  canAddLines: boolean("can_add_lines").default(true),
  canViewCredentials: boolean("can_view_credentials").default(true),
  allowedBouquets: jsonb("allowed_bouquets").$type<number[]>().default([]), // Empty = all
  maxLines: integer("max_lines").default(0), // 0 = unlimited
  colorCode: text("color_code").default("#6366f1"),
});

// Packages (Subscription packages for resellers)
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  packageName: text("package_name").notNull(),
  durationDays: integer("duration_days").notNull(), // 30, 90, 365, etc.
  credits: integer("credits").notNull(), // Cost in credits
  maxConnections: integer("max_connections").default(1),
  isTrial: boolean("is_trial").default(false),
  bouquets: jsonb("bouquets").$type<number[]>().default([]),
  allowedOutputs: jsonb("allowed_outputs").$type<string[]>().default(["m3u8", "ts"]),
  enabled: boolean("enabled").default(true),
  description: text("description"),
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
  // Advanced options
  ispLock: text("isp_lock"), // Lock to specific ISP
  forcedServerId: integer("forced_server_id").references(() => servers.id), // Route to specific server
  allowedUserAgents: jsonb("allowed_user_agents").$type<string[]>().default([]), // Whitelist UAs
  bypassUaCheck: boolean("bypass_ua_check").default(false),
  packageId: integer("package_id").references(() => packages.id),
  playToken: text("play_token"), // Secure playback token
  parentResellerIdd: integer("parent_reseller_id"), // Hierarchy
  adminEnabled: boolean("admin_enabled").default(true), // Separate admin toggle
  // New 1-Stream features
  allowedDomains: jsonb("allowed_domains").$type<string[]>().default([]), // Restrict playback domains
  fingerprintEnabled: boolean("fingerprint_enabled").default(false),
  fingerprintId: integer("fingerprint_id"),
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

// IP Rate Limiting / Login Attempts
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  username: text("username"),
  success: boolean("success").default(false),
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

// Rate Limit Settings
export const rateLimitSettings = pgTable("rate_limit_settings", {
  id: serial("id").primaryKey(),
  maxFailedAttempts: integer("max_failed_attempts").default(10),
  lockoutDurationMinutes: integer("lockout_duration_minutes").default(60),
  attemptWindowMinutes: integer("attempt_window_minutes").default(15),
  enabled: boolean("enabled").default(true),
});

// Activation Codes (Pre-generated codes for line activation)
export const activationCodes = pgTable("activation_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  packageId: integer("package_id").references(() => packages.id),
  bouquets: jsonb("bouquets").$type<number[]>().default([]),
  durationDays: integer("duration_days").notNull(),
  maxConnections: integer("max_connections").default(1),
  createdBy: integer("created_by").references(() => users.id),
  usedBy: integer("used_by"), // Line ID when redeemed
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"), // Code expiration (not subscription)
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Connection History (Detailed tracking of all connections)
export const connectionHistory = pgTable("connection_history", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => lines.id),
  streamId: integer("stream_id").references(() => streams.id),
  serverId: integer("server_id").references(() => servers.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  country: text("country"),
  city: text("city"),
  isp: text("isp"),
  isVpn: boolean("is_vpn").default(false),
  isProxy: boolean("is_proxy").default(false),
  isDatacenter: boolean("is_datacenter").default(false),
  deviceId: text("device_id"),
  playerType: text("player_type"), // TiviMate, Smarters, VLC, etc.
  bytesTransferred: integer("bytes_transferred").default(0),
  duration: integer("duration").default(0), // seconds
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

// Most Watched Analytics
export const mostWatched = pgTable("most_watched", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => streams.id).notNull(),
  streamType: text("stream_type").default("live"), // live, movie, series
  totalViews: integer("total_views").default(0),
  totalDuration: integer("total_duration").default(0), // seconds
  uniqueViewers: integer("unique_viewers").default(0),
  peakConcurrent: integer("peak_concurrent").default(0),
  lastWatched: timestamp("last_watched"),
  dateRecorded: timestamp("date_recorded").defaultNow(),
});

// Two-Factor Authentication
export const twoFactorAuth = pgTable("two_factor_auth", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  secret: text("secret").notNull(),
  backupCodes: jsonb("backup_codes").$type<string[]>().default([]),
  enabled: boolean("enabled").default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fingerprint/Watermark Settings
export const fingerprintSettings = pgTable("fingerprint_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fingerprintType: text("fingerprint_type").default("text"), // text, image
  text: text("text"), // Variables: {username}, {ip}, {date}, {time}
  imageUrl: text("image_url"),
  position: text("position").default("bottom-right"), // top-left, top-right, bottom-left, bottom-right, center
  opacity: real("opacity").default(0.5),
  fontSize: integer("font_size").default(14),
  fontColor: text("font_color").default("#FFFFFF"),
  backgroundColor: text("background_color"),
  margin: integer("margin").default(10),
  applyToLive: boolean("apply_to_live").default(true),
  applyToVod: boolean("apply_to_vod").default(true),
  applyToSeries: boolean("apply_to_series").default(true),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Line Fingerprints (Per-line watermark settings)
export const lineFingerprints = pgTable("line_fingerprints", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => lines.id).notNull(),
  fingerprintId: integer("fingerprint_id").references(() => fingerprintSettings.id),
  customText: text("custom_text"),
  enabled: boolean("enabled").default(true),
});

// Watch Folders (Auto-import from directories)
export const watchFolders = pgTable("watch_folders", {
  id: serial("id").primaryKey(),
  folderName: text("folder_name").notNull(),
  folderPath: text("folder_path").notNull(),
  folderType: text("folder_type").default("movie"), // movie, series, live_m3u
  categoryId: integer("category_id").references(() => categories.id),
  serverId: integer("server_id").references(() => servers.id),
  autoImport: boolean("auto_import").default(true),
  deleteAfterImport: boolean("delete_after_import").default(false),
  fetchTmdbInfo: boolean("fetch_tmdb_info").default(true),
  transcodeProfileId: integer("transcode_profile_id").references(() => transcodeProfiles.id),
  lastScanned: timestamp("last_scanned"),
  filesFound: integer("files_found").default(0),
  filesImported: integer("files_imported").default(0),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Watch Folder Logs
export const watchFolderLogs = pgTable("watch_folder_logs", {
  id: serial("id").primaryKey(),
  watchFolderId: integer("watch_folder_id").references(() => watchFolders.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").default(0),
  status: text("status").default("pending"), // pending, importing, imported, failed
  streamId: integer("stream_id").references(() => streams.id),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Looping Channels (24/7 channels with playlist)
export const loopingChannels = pgTable("looping_channels", {
  id: serial("id").primaryKey(),
  channelName: text("channel_name").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  streamIcon: text("stream_icon"),
  playlist: jsonb("playlist").$type<{streamId: number, order: number}[]>().default([]),
  loopMode: text("loop_mode").default("sequential"), // sequential, shuffle, single
  currentIndex: integer("current_index").default(0),
  currentStartTime: timestamp("current_start_time"),
  transitionType: text("transition_type").default("cut"), // cut, fade
  serverId: integer("server_id").references(() => servers.id),
  transcodeProfileId: integer("transcode_profile_id").references(() => transcodeProfiles.id),
  outputStreamId: integer("output_stream_id").references(() => streams.id),
  epgChannelId: text("epg_channel_id"),
  status: text("status").default("stopped"), // stopped, running, error
  pid: integer("pid").default(0),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Autoblock Rules
export const autoblockRules = pgTable("autoblock_rules", {
  id: serial("id").primaryKey(),
  ruleName: text("rule_name").notNull(),
  ruleType: text("rule_type").notNull(), // expired_line, failed_auth, vpn_proxy, suspicious_ua, connection_limit
  threshold: integer("threshold").default(5), // Number of attempts before block
  timeWindowMinutes: integer("time_window_minutes").default(15),
  blockDurationMinutes: integer("block_duration_minutes").default(60),
  blockType: text("block_type").default("temporary"), // temporary, permanent
  notifyAdmin: boolean("notify_admin").default(false),
  enabled: boolean("enabled").default(true),
  triggeredCount: integer("triggered_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Statistics Snapshots (For analytics dashboard)
export const statisticsSnapshots = pgTable("statistics_snapshots", {
  id: serial("id").primaryKey(),
  snapshotType: text("snapshot_type").default("hourly"), // hourly, daily, weekly, monthly
  totalConnections: integer("total_connections").default(0),
  peakConnections: integer("peak_connections").default(0),
  uniqueUsers: integer("unique_users").default(0),
  totalBandwidth: real("total_bandwidth").default(0), // GB
  activeLines: integer("active_lines").default(0),
  expiredLines: integer("expired_lines").default(0),
  newLines: integer("new_lines").default(0),
  topCountries: jsonb("top_countries").$type<{country: string, count: number}[]>().default([]),
  topStreams: jsonb("top_streams").$type<{streamId: number, views: number}[]>().default([]),
  serverStats: jsonb("server_stats").$type<{serverId: number, load: number, connections: number}[]>().default([]),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Admin Impersonation Log (Login as user)
export const impersonationLogs = pgTable("impersonation_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
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
export const insertBackupSchema = createInsertSchema(backups).omit({ id: true, createdAt: true, completedAt: true });
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ id: true, createdAt: true, lastTriggered: true });
export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({ id: true, createdAt: true });
export const insertResellerGroupSchema = createInsertSchema(resellerGroups).omit({ id: true });
export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });
export const insertTicketReplySchema = createInsertSchema(ticketReplies).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertAccessOutputSchema = createInsertSchema(accessOutputs).omit({ id: true });
export const insertReservedUsernameSchema = createInsertSchema(reservedUsernames).omit({ id: true, createdAt: true });
export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({ id: true, attemptedAt: true });
export const insertRateLimitSettingsSchema = createInsertSchema(rateLimitSettings).omit({ id: true });
export const insertCreatedChannelSchema = createInsertSchema(createdChannels).omit({ id: true, addedAt: true, pid: true, status: true });
export const insertEnigma2DeviceSchema = createInsertSchema(enigma2Devices).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertEnigma2ActionSchema = createInsertSchema(enigma2Actions).omit({ id: true, createdAt: true, status: true });
export const insertSignalSchema = createInsertSchema(signals).omit({ id: true, createdAt: true, lastTriggered: true, triggerCount: true });

// New 1-Stream feature schemas
export const insertActivationCodeSchema = createInsertSchema(activationCodes).omit({ id: true, createdAt: true, usedAt: true });
export const insertConnectionHistorySchema = createInsertSchema(connectionHistory).omit({ id: true, startedAt: true, endedAt: true });
export const insertMostWatchedSchema = createInsertSchema(mostWatched).omit({ id: true, dateRecorded: true, lastWatched: true });
export const insertTwoFactorAuthSchema = createInsertSchema(twoFactorAuth).omit({ id: true, createdAt: true, verifiedAt: true });
export const insertFingerprintSettingsSchema = createInsertSchema(fingerprintSettings).omit({ id: true, createdAt: true });
export const insertLineFingerprintSchema = createInsertSchema(lineFingerprints).omit({ id: true });
export const insertWatchFolderSchema = createInsertSchema(watchFolders).omit({ id: true, createdAt: true, lastScanned: true });
export const insertWatchFolderLogSchema = createInsertSchema(watchFolderLogs).omit({ id: true, createdAt: true });
export const insertLoopingChannelSchema = createInsertSchema(loopingChannels).omit({ id: true, createdAt: true, pid: true, status: true });
export const insertAutoblockRuleSchema = createInsertSchema(autoblockRules).omit({ id: true, createdAt: true, triggeredCount: true, lastTriggered: true });
export const insertStatisticsSnapshotSchema = createInsertSchema(statisticsSnapshots).omit({ id: true, recordedAt: true });
export const insertImpersonationLogSchema = createInsertSchema(impersonationLogs).omit({ id: true, startedAt: true, endedAt: true });

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

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = z.infer<typeof insertBackupSchema>;

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type ResellerGroup = typeof resellerGroups.$inferSelect;
export type InsertResellerGroup = z.infer<typeof insertResellerGroupSchema>;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type TicketReply = typeof ticketReplies.$inferSelect;
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;

export type RateLimitSettings = typeof rateLimitSettings.$inferSelect;
export type InsertRateLimitSettings = z.infer<typeof insertRateLimitSettingsSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type AccessOutput = typeof accessOutputs.$inferSelect;
export type InsertAccessOutput = z.infer<typeof insertAccessOutputSchema>;

export type ReservedUsername = typeof reservedUsernames.$inferSelect;
export type InsertReservedUsername = z.infer<typeof insertReservedUsernameSchema>;

export type CreatedChannel = typeof createdChannels.$inferSelect;
export type InsertCreatedChannel = z.infer<typeof insertCreatedChannelSchema>;

export type Enigma2Device = typeof enigma2Devices.$inferSelect;
export type InsertEnigma2Device = z.infer<typeof insertEnigma2DeviceSchema>;

export type Enigma2Action = typeof enigma2Actions.$inferSelect;
export type InsertEnigma2Action = z.infer<typeof insertEnigma2ActionSchema>;

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;

// New 1-Stream feature types
export type ActivationCode = typeof activationCodes.$inferSelect;
export type InsertActivationCode = z.infer<typeof insertActivationCodeSchema>;

export type ConnectionHistory = typeof connectionHistory.$inferSelect;
export type InsertConnectionHistory = z.infer<typeof insertConnectionHistorySchema>;

export type MostWatched = typeof mostWatched.$inferSelect;
export type InsertMostWatched = z.infer<typeof insertMostWatchedSchema>;

export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;
export type InsertTwoFactorAuth = z.infer<typeof insertTwoFactorAuthSchema>;

export type FingerprintSettings = typeof fingerprintSettings.$inferSelect;
export type InsertFingerprintSettings = z.infer<typeof insertFingerprintSettingsSchema>;

export type LineFingerprint = typeof lineFingerprints.$inferSelect;
export type InsertLineFingerprint = z.infer<typeof insertLineFingerprintSchema>;

export type WatchFolder = typeof watchFolders.$inferSelect;
export type InsertWatchFolder = z.infer<typeof insertWatchFolderSchema>;

export type WatchFolderLog = typeof watchFolderLogs.$inferSelect;
export type InsertWatchFolderLog = z.infer<typeof insertWatchFolderLogSchema>;

export type LoopingChannel = typeof loopingChannels.$inferSelect;
export type InsertLoopingChannel = z.infer<typeof insertLoopingChannelSchema>;

export type AutoblockRule = typeof autoblockRules.$inferSelect;
export type InsertAutoblockRule = z.infer<typeof insertAutoblockRuleSchema>;

export type StatisticsSnapshot = typeof statisticsSnapshots.$inferSelect;
export type InsertStatisticsSnapshot = z.infer<typeof insertStatisticsSnapshotSchema>;

export type ImpersonationLog = typeof impersonationLogs.$inferSelect;
export type InsertImpersonationLog = z.infer<typeof insertImpersonationLogSchema>;

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

// Two-Factor Authentication Activity Log
export const twoFactorActivity = pgTable("two_factor_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'setup', 'enable', 'disable', 'verify_success', 'verify_failed'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// IP Whitelisting
export const ipWhitelist = pgTable("ip_whitelist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // null = global rule
  ipAddress: text("ip_address").notNull(),
  ipRange: text("ip_range"), // CIDR notation (e.g., "192.168.1.0/24")
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isGlobal: boolean("is_global").default(false), // Global rules apply to all users
  allowAdmin: boolean("allow_admin").default(true),
  allowReseller: boolean("allow_reseller").default(true),
  createdBy: integer("created_by").references(() => users.id),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comprehensive Audit Logging
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  username: text("username"),
  action: text("action").notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', etc.
  resource: text("resource").notNull(), // 'stream', 'line', 'user', 'category', etc.
  resourceId: integer("resource_id"),
  method: text("method"), // HTTP method
  path: text("path"), // API path
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestBody: jsonb("request_body"),
  responseStatus: integer("response_status"),
  errorMessage: text("error_message"),
  duration: integer("duration"), // milliseconds
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// Stream Schedule types
export type StreamSchedule = typeof streamSchedules.$inferSelect;
export type InsertStreamSchedule = typeof streamSchedules.$inferInsert;
export type TwoFactorActivity = typeof twoFactorActivity.$inferSelect;
export type InsertTwoFactorActivity = typeof twoFactorActivity.$inferInsert;

// IP Whitelist types
export type IpWhitelist = typeof ipWhitelist.$inferSelect;
export type InsertIpWhitelist = typeof ipWhitelist.$inferInsert;

// Audit Log types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ===================================
// PHASE 2: REAL-TIME BANDWIDTH MONITORING
// ===================================

// Bandwidth Statistics (aggregated by time period)
export const bandwidthStats = pgTable("bandwidth_stats", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id),
  lineId: integer("line_id").references(() => lines.id),
  streamId: integer("stream_id").references(() => streams.id),
  
  // Bandwidth metrics (in bytes)
  bytesIn: integer("bytes_in").default(0).notNull(),
  bytesOut: integer("bytes_out").default(0).notNull(),
  bytesTotal: integer("bytes_total").default(0).notNull(),
  
  // Rate metrics (bytes per second)
  rateIn: real("rate_in").default(0), // Current download rate
  rateOut: real("rate_out").default(0), // Current upload rate
  
  // Connection metrics
  activeConnections: integer("active_connections").default(0),
  peakConnections: integer("peak_connections").default(0),
  
  // Time window
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  granularity: text("granularity").default("5min"), // '1min', '5min', '1hour', '1day'
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Bandwidth Alerts/Thresholds
export const bandwidthAlerts = pgTable("bandwidth_alerts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  
  // Alert scope
  scope: text("scope").notNull(), // 'global', 'server', 'line', 'stream'
  serverId: integer("server_id").references(() => servers.id),
  lineId: integer("line_id").references(() => lines.id),
  streamId: integer("stream_id").references(() => streams.id),
  
  // Threshold configuration
  metric: text("metric").notNull(), // 'bandwidth', 'connections', 'bitrate'
  operator: text("operator").notNull(), // 'greater_than', 'less_than', 'equal_to'
  threshold: real("threshold").notNull(),
  duration: integer("duration").default(300), // seconds to sustain before triggering
  
  // Actions
  actions: jsonb("actions").$type<string[]>().default([]), // ['email', 'webhook', 'sms']
  webhookUrl: text("webhook_url"),
  emailRecipients: jsonb("email_recipients").$type<string[]>().default([]),
  
  // Status
  enabled: boolean("enabled").default(true),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Bandwidth Stats types
export type BandwidthStat = typeof bandwidthStats.$inferSelect;
export type InsertBandwidthStat = typeof bandwidthStats.$inferInsert;

// Bandwidth Alert types
export type BandwidthAlert = typeof bandwidthAlerts.$inferSelect;
export type InsertBandwidthAlert = typeof bandwidthAlerts.$inferInsert;

