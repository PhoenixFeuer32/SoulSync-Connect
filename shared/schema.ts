import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, json, boolean, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companions = pgTable("companions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  personality: jsonb("personality"),
  voiceId: text("voice_id"),
  voiceProvider: text("voice_provider").default("elevenlabs"),
  kindroidApiKey: text("kindroid_api_key"),
  kindroidBotId: text("kindroid_bot_id"), // Unique bot ID from Kindroid API
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiCredentials = pgTable("api_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  service: text("service").notNull(), // 'kindroid', 'elevenlabs', 'twilio', 'spotify'
  encryptedKey: text("encrypted_key").notNull(),
  encryptedSecret: text("encrypted_secret"),
  phonenumber: text("phone_number"), // ← ADD THIS LINE!
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companionId: varchar("companion_id").references(() => companions.id).notNull(),
  twilioCallSid: text("twilio_call_sid"),
  duration: integer("duration"), // in seconds
  status: text("status").notNull(), // 'initiated', 'connected', 'completed', 'failed'
  quality: text("quality"), // 'HD', 'good', 'poor'
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // 'error', 'warn', 'info', 'debug'
  service: text("service").notNull(), // 'kindroid', 'elevenlabs', 'twilio', 'system'
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: jsonb("metadata"),
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const fileShares = pgTable("file_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companionId: varchar("companion_id").references(() => companions.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const smsCommands = pgTable("sms_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  phonenumber: text("phone_number").notNull(),
  command: text("command").notNull(),
  response: text("response"),
  twilioMessageSid: text("twilio_message_sid"),
  status: text("status").notNull(), // 'received', 'processed', 'failed'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metric: text("metric").notNull(), // 'api_latency', 'cpu_usage', 'memory_usage', 'error_rate'
  service: text("service").notNull(),
  value: decimal("value").notNull(),
  unit: text("unit").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
// Add this after your existing tables (around line 60+)
export const userThemes = pgTable("user_themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  themeName: text("theme_name").notNull(), // "Dark Galaxy", "Windows Fluent", etc.
  themeSource: text("theme_source").notNull(), // "galaxy", "windows", "custom"
  themeData: json("theme_data"), // CSS variables, colors, etc.
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCompanionSchema = createInsertSchema(companions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiCredentialSchema = createInsertSchema(apiCredentials).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCallLogSchema = createInsertSchema(callLogs).omit({ id: true, startedAt: true });
export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({ id: true, timestamp: true });
export const insertFileShareSchema = createInsertSchema(fileShares).omit({ id: true, createdAt: true });
export const insertSmsCommandSchema = createInsertSchema(smsCommands).omit({ id: true, timestamp: true });
export const insertSystemMetricSchema = createInsertSchema(systemMetrics).omit({ id: true, timestamp: true });
// Add this for theme validation- Themes
export const insertUserThemeSchema = createInsertSchema(userThemes).omit({ id: true, createdAt: true, updatedAt: true });
export const selectUserThemeSchema = createSelectSchema(userThemes);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Companion = typeof companions.$inferSelect;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type ApiCredential = typeof apiCredentials.$inferSelect;
export type InsertApiCredential = z.infer<typeof insertApiCredentialSchema>;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type FileShare = typeof fileShares.$inferSelect;
export type InsertFileShare = z.infer<typeof insertFileShareSchema>;
export type SmsCommand = typeof smsCommands.$inferSelect;
export type InsertSmsCommand = z.infer<typeof insertSmsCommandSchema>;
export type SystemMetric = typeof systemMetrics.$inferSelect;
export type InsertSystemMetric = z.infer<typeof insertSystemMetricSchema>;

// Add these after your existing types (around line 110+)- Themes
export type UserTheme = typeof userThemes.$inferSelect;
export type InsertUserTheme = z.infer<typeof insertUserThemeSchema>;