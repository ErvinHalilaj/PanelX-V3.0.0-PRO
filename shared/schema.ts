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
  transcodeProfileId: integer("transcode_profile_id"),
  streamIcon: text("stream_icon"),
  epgChannelId: text("epg_channel_id"),
  notes: text("notes"),
  isDirect: boolean("is_direct").default(false),
  isMonitored: boolean("is_monitored").default(true),
  monitorStatus: text("monitor_status").default("unknown"), // online, offline, unknown
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
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
export const insertStreamSchema = createInsertSchema(streams).omit({ id: true, createdAt: true, lastChecked: true });
export const insertBouquetSchema = createInsertSchema(bouquets).omit({ id: true });
export const insertLineSchema = createInsertSchema(lines).omit({ id: true, createdAt: true, lastActivity: true });
export const insertActiveConnectionSchema = createInsertSchema(activeConnections).omit({ id: true, startedAt: true, lastPing: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });

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
