import dotenv from "dotenv";
dotenv.config();
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { encrypt, decrypt, hashPassword, verifypassword } from "./encryption.js";
import { Logger } from "./logger.js";
import { insertCompanionSchema, insertApiCredentialSchema } from "../shared/schema.js";
import { db } from "./db.js"; // Add this import
import * as schema from "../shared/schema.js"; // Add this import
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fetch from "node-fetch"; // Lets you make HTTP requests from Node.js
import { eq, and } from "drizzle-orm";

const galaxyApiKey = process.env.GALAXY_THEME_API_KEY;
const windowsApiKey = process.env.WINDOWS_THEME_API_KEY;

const upload = multer({ dest: 'uploads/' });
// Add debug Users
async function ensureDefaultUser() {
  try {
    // Check if any users exist
    const existingUsers = await db.select().from(schema.users).limit(1);
    
    if (existingUsers.length === 0) {
      // Create default user
      const defaultUser = await db.insert(schema.users).values({
        id: 'default-user',
        username: 'defaultuser',  // Add this line!
        name: 'Default User',
        email: 'admin@soulsync.app',
        password: hashPassword('defaultpassword123'),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      Logger.info('system', 'Created default user', { userId: 'default-user' });
      console.log('✅ Created default user: default-user');
    } else {
      console.log('✅ Users table already has data');
    }
  } catch (error) {
    Logger.error('system', 'Failed to ensure default user', error as Error);
    console.log('❌ Error creating default user:', error);
  }
}
  // ... rest of your existing code stays the same

  export async function registerRoutes(app: Express): Promise<Server> {
    await ensureDefaultUser();
  
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    Logger.info('websocket', 'Client connected');
    
    ws.on('close', () => {
      clients.delete(ws);
      Logger.info('websocket', 'Client disconnected');
    });
    
    ws.on('error', (error) => {
      Logger.error('websocket', 'WebSocket error', error);
    });
  });

  // Broadcast to all connected clients
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Middleware for error handling and logging
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        Logger.error('api', `${req.method} ${req.path} - ${res.statusCode}`);
        // Optionally, log metadata separately:
        Logger.info('api', 'Request details', {
          path: req.path,
          statusCode: res.statusCode,
          body: req.body
        });
      }
    });
    // If you want to log the method separately:
    Logger.info('api', `HTTP method: ${req.method}`);
    next();
  });

  // Dashboard data endpoint
  // ...existing code...
  app.get("/api/dashboard", async (req: Request, res: Response) => {
    try {
      const companions = await storage.getCompanions("default-user"); // TODO: Use actual user auth
      const recentLogs = await storage.getCallLogs("default-user", 10);
      const errorLogs = await storage.getErrorLogs(undefined, undefined, 50);
      const metrics = await storage.getSystemMetrics(undefined, undefined, 100);
      
      res.json({
        companions,
        recentLogs,
        errorLogs,
        metrics,
        systemStatus: {
          kindroid: 'connected',
          elevenlabs: 'connected',
          twilio: 'connected',
          database: 'healthy'
        }
      });
    } catch (error) {
      Logger.error('api', 'Failed to fetch dashboard data', error as Error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Companions endpoints
  app.get("/api/companions", async (req, res) => {
    try {
      const companions = await storage.getCompanions("default-user");
      res.json(companions);
    } catch (error) {
      Logger.error('api', 'Failed to fetch companions', error as Error);
      res.status(500).json({ error: 'Failed to fetch companions' });
    }
  });

  app.post("/api/companions", async (req, res) => {
    try {
      const companionData = insertCompanionSchema.parse({
        ...req.body,
        userId: "default-user"
      });
      
      const companion = await storage.createCompanion(companionData);
      Logger.info('api', 'Companion created', { companionId: companion.id });
      
      broadcast({ type: 'companion_created', data: companion });
      res.json(companion);
    } catch (error) {
      Logger.error('api', 'Failed to create companion', error as Error);
      res.status(500).json({ error: 'Failed to create companion' });
    }
  });

  app.put("/api/companions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const companion = await storage.updateCompanion(id, updateData);
      Logger.info('api', 'Companion updated', { companionId: id });
      
      broadcast({ type: 'companion_updated', data: companion });
      res.json(companion);
    } catch (error) {
      Logger.error('api', 'Failed to update companion', error as Error);
      res.status(500).json({ error: 'Failed to update companion' });
    }
  });

  app.delete("/api/companions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanion(id);
      
      Logger.info('api', 'Companion deleted', { companionId: id });
      broadcast({ type: 'companion_deleted', data: { id } });
      res.json({ success: true });
    } catch (error) {
      Logger.error('api', 'Failed to delete companion', error as Error);
      res.status(500).json({ error: 'Failed to delete companion' });
    }
  });

  app.post("/api/companions/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.setActiveCompanion("default-user", id);
      
      Logger.info('api', 'Companion activated', { companionId: id });
      broadcast({ type: 'companion_activated', data: { id } });
      res.json({ success: true });
    } catch (error) {
      Logger.error('api', 'Failed to activate companion', error as Error);
      res.status(500).json({ error: 'Failed to activate companion' });
    }
  });

  // API Credentials endpoints (encrypted)
  app.get("/api/credentials", async (req, res) => {
    try {
      const credentials = await storage.getApiCredentials("default-user");
      // Decrypt for display (but don't send full keys)
      const safeCredentials = credentials.map(cred => ({
        ...cred,
        encryptedKey: cred.encryptedKey ? '***' + cred.encryptedKey.slice(-4) : null,
        encryptedSecret: cred.encryptedSecret ? '***' + cred.encryptedSecret.slice(-4) : null
      }));
      
      res.json(safeCredentials);
    } catch (error) {
      Logger.error('api', 'Failed to fetch credentials', error as Error);
      res.status(500).json({ error: 'Failed to fetch credentials' });
    }
  });

  app.post("/api/credentials", async (req, res) => {
    try {
      const { service, key, secret, phonenumber } = req.body;
      
      const credentialData = insertApiCredentialSchema.parse({
        userId: "default-user",
        service,
        encryptedKey: encrypt(key),
        encryptedSecret: secret ? encrypt(secret) : null,
        phonenumber: phonenumber || null
      });
      
      const credential = await storage.createApiCredential(credentialData);
      Logger.info('api', 'API credential stored', { service });
      
      res.json({ success: true, id: credential.id });
    } catch (error) {
      Logger.error('api', 'Failed to store credential', error as Error);
      res.status(500).json({ error: 'Failed to store credential' });
    }
  });

  app.post("/api/credentials/test/:service", async (req, res) => {
    try {
      const { service } = req.params;
      const credentials = await storage.getApiCredentials("default-user", service);
      
      if (credentials.length === 0) {
        return res.status(404).json({ error: 'No credentials found for service' });
      }
      
      const cred = credentials[0];
      const decryptedKey = decrypt(cred.encryptedKey);
      
      // TODO: Implement actual API tests for each service
      Logger.info('api', 'Testing API credentials', { service });
      
      res.json({ success: true, status: 'connected' });
    } catch (error) {
      Logger.error('api', 'Failed to test credentials', error as Error);
      res.status(500).json({ error: 'Failed to test credentials' });
    }
  });

  // Call management endpoints
  app.post("/api/calls/start", async (req, res) => {
    try {
      const { companionId } = req.body;
      
      // Create call log
      const callLog = await storage.createCallLog({
        userId: "default-user",
        companionId,
        status: "initiated"
      });
      
      Logger.info('twilio', 'Call initiated', { callId: callLog.id, companionId });
      broadcast({ type: 'call_started', data: callLog });
      
      res.json({ callId: callLog.id, status: 'initiated' });
    } catch (error) {
      Logger.error('api', 'Failed to start call', error as Error);
      res.status(500).json({ error: 'Failed to start call' });
    }
  });

  app.post("/api/calls/:id/end", async (req, res) => {
    try {
      const { id } = req.params;
      const { duration } = req.body;
      
      const callLog = await storage.updateCallLog(id, {
        status: "completed",
        duration,
        endedAt: new Date()
      });
      
      Logger.info('twilio', 'Call ended', { callId: id, duration });
      broadcast({ type: 'call_ended', data: callLog });
      
      res.json(callLog);
    } catch (error) {
      Logger.error('api', 'Failed to end call', error as Error);
      res.status(500).json({ error: 'Failed to end call' });
    }
  });

  // Twilio webhooks
  app.post("/webhooks/twilio/call-status", async (req, res) => {
    try {
      const { CallSid, CallStatus, Duration } = req.body;
      
      Logger.info('twilio', 'Call status webhook received', { 
        callSid: CallSid, 
        status: CallStatus,
        duration: Duration 
      });
      
      // Find and update call log
      const callLogs = await storage.getCallLogs("default-user");
      const callLog = callLogs.find(log => log.twilioCallSid === CallSid);
      
      if (callLog) {
        await storage.updateCallLog(callLog.id, {
          status: CallStatus,
          duration: Duration ? parseInt(Duration) : undefined
        });
        
        broadcast({ type: 'call_status_update', data: { CallSid, CallStatus, Duration } });
      }
      
      res.sendStatus(200);
    } catch (error) {
      Logger.error('twilio', 'Webhook processing failed', error as Error);
      res.sendStatus(500);
    }
  });

  app.post("/webhooks/twilio/sms", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;
      
      const smsCommand = await storage.createSmsCommand({
        userId: "default-user", // TODO: Map phone number to user
        phonenumber: From,
        command: Body,
        twilioMessageSid: MessageSid,
        status: "received"
      });
      
      Logger.info('twilio', 'SMS command received', { from: From, command: Body });
      broadcast({ type: 'sms_received', data: smsCommand });
      
      res.sendStatus(200);
    } catch (error) {
      Logger.error('twilio', 'SMS webhook processing failed', error as Error);
      res.sendStatus(500);
    }
  });

  // File sharing endpoints
  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getFileShares("default-user");
      res.json(files);
    } catch (error) {
      Logger.error('api', 'Failed to fetch files', error as Error);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const fileShare = await storage.createFileShare({
        userId: "default-user",
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });
      
      Logger.info('api', 'File uploaded', { fileId: fileShare.id, originalName: req.file.originalname });
      broadcast({ type: 'file_uploaded', data: fileShare });
      
      res.json(fileShare);
    } catch (error) {
      Logger.error('api', 'Failed to upload file', error as Error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get file info before deletion
      const files = await storage.getFileShares("default-user");
      const file = files.find(f => f.id === id);
      
      if (file) {
        // Delete file from filesystem
        try {
          await fs.unlink(file.path);
        } catch (error) {
          Logger.warn('api', 'Failed to delete file from filesystem', { path: file.path });
        }
        
        await storage.deleteFileShare(id);
        Logger.info('api', 'File deleted', { fileId: id });
        broadcast({ type: 'file_deleted', data: { id } });
      }
      
      res.json({ success: true });
    } catch (error) {
      Logger.error('api', 'Failed to delete file', error as Error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // ...existing code...

  app.get("/api/diagnostics/metrics", async (req, res) => {
    // ...diagnostics code...
  });

    // System logs
  app.get("/api/diagnostics/logs", async (req, res) => {
    try {
      const { service, level, limit } = req.query;
      const logs = await storage.getErrorLogs(
        undefined, 
        service as string, 
        limit ? parseInt(limit as string) : 100
      );
      res.json(logs);
    } catch (error) {
      Logger.error('api', 'Failed to fetch logs', error as Error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // System metrics
  app.get("/api/diagnostics/metrics", async (req, res) => {
    try {
      const { service, metric, limit } = req.query;
      const metrics = await storage.getSystemMetrics(
        service as string,
        metric as string,
        limit ? parseInt(limit as string) : 100
      );
      res.json(metrics);
    } catch (error) {
      Logger.error('api', 'Failed to fetch metrics', error as Error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // --- ADD THEME ROUTES HERE ---
  app.get("/api/themes", async (req, res) => {
    try {
      const themes = await db.select().from(schema.userThemes)
        .where(eq(schema.userThemes.userId, "default-user"));
      res.json(themes);
    } catch (error) {
      Logger.error('api', 'Failed to fetch themes', error as Error);
      res.status(500).json({ error: 'Failed to fetch themes' });
    }
  });

  app.post("/api/themes", async (req, res) => {
    try {
      const { themeName, themeSource, themeData } = req.body;

      await db.update(schema.userThemes)
        .set({ isActive: false })
        .where(eq(schema.userThemes.userId, "default-user"));

      const theme = await db.insert(schema.userThemes).values({
        userId: "default-user",
        themeName,
        themeSource,
        themeData,
        isActive: true
      }).returning();

      res.json({ success: true, theme: theme[0] });
    } catch (error) {
      Logger.error('api', 'Failed to save theme', error as Error);
      res.status(500).json({ error: 'Failed to save theme' });
    }
  });

  app.get("/api/themes/search", async (req, res) => {
    const q = req.query.q as string;
    let results: any[] = [];

    // Search Open VSX Registry
    try {
      const openVSX = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(q)}`)
        .then(r => r.json()) as { extensions?: any[] };
      const github = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+vscode+theme`)
        .then(r => r.json()) as { items?: any[] };
      if (openVSX.extensions) {
        results = results.concat(
          openVSX.extensions.map((ext: any) => ({
            name: ext.name || ext.displayName || "Unknown",
            source: Array.isArray(ext.files)
              ? ext.files.find((f: any) => typeof f.path === "string" && f.path.endsWith(".json"))?.path || ""
              : "",
            preview: ext.icon || "#222",
            repo: ext.repository,
            type: "OpenVSX"
          }))
        );
      }
    } catch (err) {
      Logger.error('theme-search', 'OpenVSX fetch failed', err as Error);
    }

    // Search GitHub for VS Code themes
    try {
      const github = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+vscode+theme`)
        .then(r => r.json()) as { items?: any[] };
      if (github.items) {
        results = results.concat(
          github.items.map((repo: any) => {
            const user = repo.owner?.login || "unknown-user";
            const name = repo.name || "unknown-theme";
            const possiblePaths = [
              `https://raw.githubusercontent.com/${user}/${name}/main/themes/${name}-color-theme.json`,
              `https://raw.githubusercontent.com/${user}/${name}/main/theme/${name}-color-theme.json`,
              `https://raw.githubusercontent.com/${user}/${name}/main/${name}-color-theme.json`,
              `https://raw.githubusercontent.com/${user}/${name}/main/themes/theme.json`,
              `https://raw.githubusercontent.com/${user}/${name}/main/theme.json`,
            ];
            return {
              name: repo.name || "Unknown",
              source: possiblePaths[0], // Use the first guess
              preview: "#222",
              repo: repo.html_url,
              type: "GitHub"
            };
          })
        );
      }
    } catch (err) {
      Logger.error('theme-search', 'GitHub fetch failed', err as Error);
    }

    // VS Code Marketplace (no public API, just a link)
    results.push({
      name: `Search "${q}" on VS Code Marketplace`,
      source: `https://marketplace.visualstudio.com/search?target=VSCode&category=Themes&search=${encodeURIComponent(q)}`,
      preview: "#222",
      repo: null,
      type: "VSCode Marketplace"
    });

    // Dribbble (no public API, just a link)
    results.push({
      name: `Search "${q}" on Dribbble`,
      source: `https://dribbble.com/search/${encodeURIComponent(q)}?q=${encodeURIComponent(q)}&s=latest`,
      preview: "#222",
      repo: null,
      type: "Dribbble"
    });

    // ThemeForest (no public API, just a link)
    results.push({
      name: `Search "${q}" on ThemeForest`,
      source: `https://themeforest.net/search/${encodeURIComponent(q)}`,
      preview: "#222",
      repo: null,
      type: "ThemeForest"
    });

    res.json(results);
  });

  app.get("/api/themes/active", async (req, res) => {
    try {
      const activeTheme = await db.select().from(schema.userThemes)
        .where(and(
          eq(schema.userThemes.userId, "default-user"),
          eq(schema.userThemes.isActive, true)
        ))
        .limit(1);

      res.json(activeTheme[0] || null);
    } catch (error) {
      Logger.error('api', 'Failed to fetch active theme', error as Error);
      res.status(500).json({ error: 'Failed to fetch active theme' });
    }
  });
  // --- END THEME ROUTES ---

  // Debug endpoints - temporary
  app.get("/debug/users", async (req, res) => {
    // ...debug code...
  });

  app.get("/debug/credentials-schema", async (req, res) => {
    // ...debug code...
  });

  // System health check
  app.get("/api/health", async (req, res) => {
    // ...health check code...
  });

  // ...existing code...
  // Diagnostics endpoints
  app.get("/api/diagnostics/logs", async (req, res) => {
    try {
      const { service, level, limit } = req.query;
      const logs = await storage.getErrorLogs(
        undefined, 
        service as string, 
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(logs);
    } catch (error) {
      Logger.error('api', 'Failed to fetch logs', error as Error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  app.get("/api/diagnostics/metrics", async (req, res) => {
    try {
      const { service, metric, limit } = req.query;
      const metrics = await storage.getSystemMetrics(
        service as string,
        metric as string,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(metrics);
    } catch (error) {
      Logger.error('api', 'Failed to fetch metrics', error as Error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });
    // Debug endpoints - temporary
  app.get("/debug/users", async (req, res) => {
    try {
      const users = await db.select().from(schema.users).limit(10);
      res.json({
        userCount: users.length,
        users: users.slice(0, 5),
        message: users.length === 0 ? "No users found - this is the problem!" : "Users exist"
      });
    } catch (error) {
      res.json({ 
        error: error instanceof Error ? error.message : String(error),
        message: "Error querying users table"
      });
    }
  });

  app.get("/debug/credentials-schema", async (req, res) => {
    try {
      const credentials = await db.select().from(schema.apiCredentials).limit(10);
      res.json({
        message: "Checking if phonenumber field exists",
        credentialCount: credentials.length,
        credentials: credentials,
        sampleSchema: "phonenumber should be visible in the credential objects"
      });
    } catch (error) {
      res.json({ 
        error: error instanceof Error ? error.message : String(error),
        message: "Error checking credentials schema"
      });
    }
  });
  // System health check
  app.get("/api/health", async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          kindroid: 'connected',
          elevenlabs: 'connected',
          twilio: 'connected'
        }
      };
      
      res.json(health);
    } catch (error) {
      Logger.error('api', 'Health check failed', error as Error);
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Periodic metrics collection
  setInterval(async () => {
    try {
      // Collect and store system metrics
      const metrics = [
        {
          metric: 'memory_usage',
          service: 'system',
          value: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
          unit: 'MB'
        },
        {
          metric: 'uptime',
          service: 'system',
          value: process.uptime().toFixed(0),
          unit: 'seconds'
        }
      ];
      
      for (const metric of metrics) {
        await storage.createSystemMetric(metric);
      }
      
      // Broadcast metrics to connected clients
      broadcast({ type: 'metrics_update', data: metrics });
    } catch (error) {
      Logger.error('system', 'Failed to collect metrics', error as Error);
    }
  }, 30000); // Every 30 seconds

  return httpServer;
}