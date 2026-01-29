import {
  users, companions, apiCredentials, callLogs, errorLogs,
  fileShares, smsCommands, systemMetrics,
  type User, type InsertUser, type Companion, type InsertCompanion,
  type ApiCredential, type InsertApiCredential, type CallLog, type InsertCallLog,
  type ErrorLog, type InsertErrorLog, type FileShare, type InsertFileShare,
  type SmsCommand, type InsertSmsCommand, type SystemMetric, type InsertSystemMetric
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Companions
  getCompanions(userId: string): Promise<Companion[]>;
  getCompanion(id: string): Promise<Companion | undefined>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: string, companion: Partial<InsertCompanion>): Promise<Companion>;
  deleteCompanion(id: string): Promise<void>;
  setActiveCompanion(userId: string, companionId: string): Promise<void>;

  // API Credentials
  getApiCredentials(userId: string, service?: string): Promise<ApiCredential[]>;
  createApiCredential(credential: InsertApiCredential): Promise<ApiCredential>;
  updateApiCredential(id: string, credential: Partial<InsertApiCredential>): Promise<ApiCredential>;
  deleteApiCredential(id: string): Promise<void>;

  // Call Logs
  getCallLogs(userId: string, limit?: number): Promise<CallLog[]>;
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;
  updateCallLog(id: string, callLog: Partial<InsertCallLog>): Promise<CallLog>;

  // Error Logs
  getErrorLogs(userId?: string, service?: string, limit?: number): Promise<ErrorLog[]>;
  createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog>;

  // File Shares
  getFileShares(userId: string): Promise<FileShare[]>;
  createFileShare(fileShare: InsertFileShare): Promise<FileShare>;
  deleteFileShare(id: string): Promise<void>;

  // SMS Commands
  getSmsCommands(userId: string, limit?: number): Promise<SmsCommand[]>;
  createSmsCommand(smsCommand: InsertSmsCommand): Promise<SmsCommand>;

  // System Metrics
  getSystemMetrics(service?: string, metric?: string, limit?: number): Promise<SystemMetric[]>;
  createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Companions
  async getCompanions(userId: string): Promise<Companion[]> {
    return await db.select().from(companions).where(eq(companions.userId, userId)).orderBy(desc(companions.createdAt));
  }

  async getCompanion(id: string): Promise<Companion | undefined> {
    const [companion] = await db.select().from(companions).where(eq(companions.id, id));
    return companion || undefined;
  }

  async createCompanion(companion: InsertCompanion): Promise<Companion> {
    const [newCompanion] = await db.insert(companions).values(companion).returning();
    return newCompanion;
  }

  async updateCompanion(id: string, companion: Partial<InsertCompanion>): Promise<Companion> {
    const dataToUpdate = { ...companion, updatedAt: new Date() };
    const [updated] = await db.update(companions)
      .set(dataToUpdate)
      .where(eq(companions.id, id))
      .returning();
    return updated;
  }

  async deleteCompanion(id: string): Promise<void> {
    // Delete related call logs first
    await db.delete(callLogs).where(eq(callLogs.companionId, id));

    // Delete related file shares
    await db.delete(fileShares).where(eq(fileShares.companionId, id));

    // Now delete the companion
    await db.delete(companions).where(eq(companions.id, id));
  }

  async setActiveCompanion(userId: string, companionId: string): Promise<void> {
    // Deactivate all companions for user
    await db.update(companions)
      .set({ isActive: false })
      .where(eq(companions.userId, userId));
    
    // Activate selected companion
    await db.update(companions)
      .set({ isActive: true })
      .where(eq(companions.id, companionId));
  }

  // API Credentials
  async getApiCredentials(userId: string, service?: string): Promise<ApiCredential[]> {
    const baseQuery = db.select().from(apiCredentials).where(eq(apiCredentials.userId, userId));
    if (service) {
      const q = db.select().from(apiCredentials).where(and(eq(apiCredentials.userId, userId), eq(apiCredentials.service, service)));
      return await q;
    }
    return await baseQuery;
  }

  async createApiCredential(credential: InsertApiCredential): Promise<ApiCredential> {
    const [newCredential] = await db.insert(apiCredentials).values(credential).returning();
    return newCredential;
  }

  async updateApiCredential(id: string, credential: Partial<InsertApiCredential>): Promise<ApiCredential> {
    const [updated] = await db.update(apiCredentials)
      .set({ ...credential, updatedAt: new Date() })
      .where(eq(apiCredentials.id, id))
      .returning();
    return updated;
  }

  async deleteApiCredential(id: string): Promise<void> {
    await db.delete(apiCredentials).where(eq(apiCredentials.id, id));
  }

  // Call Logs
  async getCallLogs(userId: string, limit = 50): Promise<CallLog[]> {
    return await db.select().from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.startedAt))
      .limit(limit);
  }

  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    const [newLog] = await db.insert(callLogs).values(callLog).returning();
    return newLog;
  }

  async updateCallLog(id: string, callLog: Partial<InsertCallLog>): Promise<CallLog> {
    const [updated] = await db.update(callLogs)
      .set(callLog)
      .where(eq(callLogs.id, id))
      .returning();
    return updated;
  }

  // Error Logs
  async getErrorLogs(userId?: string, service?: string, limit = 100): Promise<ErrorLog[]> {
    const baseQuery = db.select().from(errorLogs);

    if (userId && service) {
      const q = db.select().from(errorLogs).where(and(eq(errorLogs.userId, userId), eq(errorLogs.service, service)));
      return await q.orderBy(desc(errorLogs.timestamp)).limit(limit);
    } else if (userId) {
      const q = db.select().from(errorLogs).where(eq(errorLogs.userId, userId));
      return await q.orderBy(desc(errorLogs.timestamp)).limit(limit);
    } else if (service) {
      const q = db.select().from(errorLogs).where(eq(errorLogs.service, service));
      return await q.orderBy(desc(errorLogs.timestamp)).limit(limit);
    }

    return await baseQuery.orderBy(desc(errorLogs.timestamp)).limit(limit);
  }

  async createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog> {
    const [newLog] = await db.insert(errorLogs).values(errorLog).returning();
    return newLog;
  }

  // File Shares
  async getFileShares(userId: string): Promise<FileShare[]> {
    return await db.select().from(fileShares)
      .where(eq(fileShares.userId, userId))
      .orderBy(desc(fileShares.createdAt));
  }

  async createFileShare(fileShare: InsertFileShare): Promise<FileShare> {
    const [newShare] = await db.insert(fileShares).values(fileShare).returning();
    return newShare;
  }

  async deleteFileShare(id: string): Promise<void> {
    await db.delete(fileShares).where(eq(fileShares.id, id));
  }

  // SMS Commands
  async getSmsCommands(userId: string, limit = 50): Promise<SmsCommand[]> {
    return await db.select().from(smsCommands)
      .where(eq(smsCommands.userId, userId))
      .orderBy(desc(smsCommands.timestamp))
      .limit(limit);
  }

  async createSmsCommand(smsCommand: InsertSmsCommand): Promise<SmsCommand> {
    const [newCommand] = await db.insert(smsCommands).values(smsCommand).returning();
    return newCommand;
  }

  // System Metrics
  async getSystemMetrics(service?: string, metric?: string, limit = 100): Promise<SystemMetric[]> {
    const baseQuery = db.select().from(systemMetrics);

    if (service && metric) {
      const q = db.select().from(systemMetrics).where(and(eq(systemMetrics.service, service), eq(systemMetrics.metric, metric)));
      return await q.orderBy(desc(systemMetrics.timestamp)).limit(limit);
    } else if (service) {
      const q = db.select().from(systemMetrics).where(eq(systemMetrics.service, service));
      return await q.orderBy(desc(systemMetrics.timestamp)).limit(limit);
    } else if (metric) {
      const q = db.select().from(systemMetrics).where(eq(systemMetrics.metric, metric));
      return await q.orderBy(desc(systemMetrics.timestamp)).limit(limit);
    }

    return await baseQuery.orderBy(desc(systemMetrics.timestamp)).limit(limit);
  }

  async createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric> {
    const [newMetric] = await db.insert(systemMetrics).values(metric).returning();
    return newMetric;
  }
}

export const storage = new DatabaseStorage();
