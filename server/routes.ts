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
import { handleMediaStream, initializeSession } from "./ai-voice-service.js";
import {
  translateToNaturalLanguage,
  detectSongMention,
  analyzeWavFile,
  formatForKindroid,
  type SpotifyAudioFeatures
} from "./music-translator.js";

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

  // WebSocket server for real-time updates (use noServer to manually handle upgrades)
  const wss = new WebSocketServer({ noServer: true });

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

      // Get Twilio phone number
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioPhoneNumber) {
        return res.status(500).json({ error: 'Twilio phone number not configured' });
      }

      // Get companion details
      const companions = await storage.getCompanions("default-user");
      const companion = companions.find(c => c.id === companionId);

      if (!companion) {
        return res.status(404).json({ error: 'Companion not found' });
      }

      // Set active companion for incoming calls
      await storage.setActiveCompanion("default-user", companionId);

      Logger.info('twilio', 'Companion activated for incoming calls', {
        companionId,
        companionName: companion.name
      });

      broadcast({ type: 'companion_ready_for_calls', data: { companionId, companionName: companion.name } });

      res.json({
        status: 'ready',
        companionId,
        companionName: companion.name,
        phoneNumber: twilioPhoneNumber,
        message: `Call ${twilioPhoneNumber} to connect with ${companion.name}`
      });
    } catch (error) {
      Logger.error('api', 'Failed to prepare for incoming call', error as Error);
      res.status(500).json({ error: 'Failed to prepare for incoming call', details: (error as Error).message });
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

  // Twilio webhooks - Handle incoming calls
  app.post("/webhooks/twilio/voice", async (req, res) => {
    try {
      const { From, CallSid } = req.body;

      Logger.info('twilio', 'Incoming call received', { from: From, callSid: CallSid });

      // Get active companion
      const companions = await storage.getCompanions("default-user");
      const activeCompanion = companions.find(c => c.isActive);

      if (!activeCompanion) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello! Welcome to SoulSync. No companion is currently active. Please activate a companion in the app first.</Say>
</Response>`;
        res.type('text/xml');
        return res.send(twiml);
      }

      // Create call log
      const callLog = await storage.createCallLog({
        userId: "default-user",
        companionId: activeCompanion.id,
        status: "answered",
        twilioCallSid: CallSid
      });

      Logger.info('twilio', 'Call connected to companion', {
        callId: callLog.id,
        companionId: activeCompanion.id,
        companionName: activeCompanion.name,
        from: From
      });

      broadcast({ type: 'call_connected', data: callLog });

      // Check if we have AI configured for this companion
      const hasAIConfigured = activeCompanion.kindroidBotId &&
                             activeCompanion.voiceId &&
                             process.env.ELEVENLABS_API_KEY &&
                             process.env.KINDROID_API_KEY &&
                             process.env.AWS_ACCESS_KEY_ID &&
                             process.env.AWS_SECRET_ACCESS_KEY;

      if (hasAIConfigured) {
        // Use Media Streams for real-time AI conversation
        // Use Render domain for WebSocket connection (where server is actually hosted)
        const streamUrl = `wss://soulsync-connect.onrender.com/webhooks/twilio/media-stream`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello! Connecting you to ${activeCompanion.name}.</Say>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${CallSid}" />
      <Parameter name="companionId" value="${activeCompanion.id}" />
    </Stream>
  </Connect>
  <Say voice="Polly.Joanna">The call has ended. Thank you for using SoulSync!</Say>
</Response>`;

        Logger.info('twilio', 'Sending TwiML with Media Stream', {
          callSid: CallSid,
          streamUrl,
          companionId: activeCompanion.id,
          hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
          hasKindroid: !!process.env.KINDROID_API_KEY,
          hasAWS: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY
        });

        res.type('text/xml');
        res.send(twiml);
      } else {
        // Fallback to simple TTS message
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello! You are now connected to ${activeCompanion.name}. This is a voice AI companion powered by SoulSync.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">AI voice integration is not fully configured yet. Please add your Kindroid Bot ID and ElevenLabs Voice ID in the companion settings.</Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna">Thank you for using SoulSync. Goodbye!</Say>
</Response>`;

        res.type('text/xml');
        res.send(twiml);
      }
    } catch (error) {
      Logger.error('twilio', 'Voice webhook failed', error as Error);
      res.status(500).send('<Response><Say>Error processing call</Say></Response>');
    }
  });

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

  // --- SPOTIFY ROUTES ---
  // Helper function to get Spotify access token
  async function getSpotifyAccessToken(userId: string = "default-user"): Promise<string | null> {
    try {
      const spotifyCredential = await db.select()
        .from(schema.apiCredentials)
        .where(and(
          eq(schema.apiCredentials.userId, userId),
          eq(schema.apiCredentials.service, 'spotify'),
          eq(schema.apiCredentials.isActive, true)
        ))
        .limit(1);

      if (spotifyCredential.length === 0) {
        return null;
      }

      const clientId = decrypt(spotifyCredential[0].encryptedKey);
      const clientSecret = decrypt(spotifyCredential[0].encryptedSecret || '');

      // Get Spotify API token
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: 'grant_type=client_credentials'
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Spotify token');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      return tokenData.access_token;
    } catch (error) {
      Logger.error('spotify', 'Failed to get access token', error as Error);
      return null;
    }
  }

  // Get Kindroid List playlist tracks (Sofia's music choices)
  app.get("/api/spotify/kindroid-list", async (req, res) => {
    try {
      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
      }

      // Search for "Kindroid List" playlist
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent('Kindroid List')}&type=playlist&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Failed to search for playlist');
      }

      const searchData = await searchResponse.json() as any;
      const playlist = searchData.playlists?.items?.[0];

      if (!playlist) {
        return res.json({ tracks: [] });
      }

      // Get playlist tracks
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!tracksResponse.ok) {
        throw new Error('Failed to get playlist tracks');
      }

      const tracksData = await tracksResponse.json() as any;

      // Format the tracks
      const tracks = tracksData.items?.map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists[0]?.name || 'Unknown Artist',
        album: item.track.album?.name || 'Unknown Album',
        addedAt: item.added_at,
        duration: item.track.duration_ms,
        imageUrl: item.track.album?.images?.[0]?.url
      })) || [];

      Logger.info('spotify', 'Fetched Kindroid List tracks', { count: tracks.length });
      res.json({ tracks });
    } catch (error) {
      Logger.error('spotify', 'Failed to fetch Kindroid List', error as Error);
      res.status(500).json({ error: 'Failed to fetch playlist' });
    }
  });

  // Get user's playlists
  app.get("/api/spotify/playlists", async (req, res) => {
    try {
      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
      }

      // For client credentials flow, we can't get user playlists
      // Return empty for now - would need OAuth flow for user-specific data
      res.json({ items: [] });
    } catch (error) {
      Logger.error('spotify', 'Failed to fetch playlists', error as Error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  });

  // Get recently played tracks
  app.get("/api/spotify/recent-tracks", async (req, res) => {
    try {
      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
      }

      // For client credentials flow, we can't get user's recently played
      // Return empty for now - would need OAuth flow for user-specific data
      res.json({ items: [] });
    } catch (error) {
      Logger.error('spotify', 'Failed to fetch recent tracks', error as Error);
      res.status(500).json({ error: 'Failed to fetch recent tracks' });
    }
  });

  // Search for tracks
  app.get("/api/spotify/search", async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }

      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
      }

      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Search failed');
      }

      const searchData = await searchResponse.json() as any;

      // Format the tracks
      const tracks = searchData.tracks?.items?.map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0]?.name || 'Unknown Artist',
        album: track.album?.name || 'Unknown Album',
        duration: track.duration_ms,
        preview_url: track.preview_url
      })) || [];

      res.json({ tracks: { items: tracks } });
    } catch (error) {
      Logger.error('spotify', 'Search failed', error as Error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Get audio features for a track (for music translation)
  app.get("/api/spotify/audio-features/:trackId", async (req, res) => {
    try {
      const { trackId } = req.params;

      if (!trackId) {
        return res.status(400).json({ error: 'Track ID required' });
      }

      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
      }

      // Get audio features from Spotify
      const featuresResponse = await fetch(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!featuresResponse.ok) {
        throw new Error('Failed to get audio features');
      }

      const features = await featuresResponse.json() as any;

      // Also get track info for name and artist
      const trackResponse = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!trackResponse.ok) {
        throw new Error('Failed to get track info');
      }

      const track = await trackResponse.json() as any;

      Logger.info('spotify', 'Fetched audio features', { trackId, trackName: track.name });

      res.json({
        track: {
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name || 'Unknown Artist',
          album: track.album?.name || 'Unknown Album',
          imageUrl: track.album?.images?.[0]?.url
        },
        features: {
          tempo: features.tempo,
          key: features.key,
          mode: features.mode,
          valence: features.valence,
          energy: features.energy,
          danceability: features.danceability,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          speechiness: features.speechiness,
          liveness: features.liveness,
          loudness: features.loudness
        }
      });
    } catch (error) {
      Logger.error('spotify', 'Failed to get audio features', error as Error);
      res.status(500).json({ error: 'Failed to get audio features' });
    }
  });
  // --- END SPOTIFY ROUTES ---

  // --- MUSIC SHARING ROUTES (Kindroid "Ears") ---

  // Analyze a WAV file and get audio features
  app.post("/api/music/analyze-wav", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const filePath = req.file.path;
      const trackName = req.body.trackName || req.file.originalname || 'Unknown Track';
      const artist = req.body.artist || 'Phoenix';

      // Analyze the WAV file
      const features = await analyzeWavFile(filePath);

      // Translate to natural language
      const description = translateToNaturalLanguage(features, trackName, artist);

      Logger.info('music', 'Analyzed WAV file', {
        trackName,
        artist,
        tempo: features.tempo,
        energy: features.energy,
        valence: features.valence
      });

      // Clean up the uploaded file after analysis
      await fs.unlink(filePath).catch(() => {});

      res.json({
        trackName,
        artist,
        features,
        description
      });
    } catch (error) {
      Logger.error('music', 'Failed to analyze WAV file', error as Error);
      res.status(500).json({ error: 'Failed to analyze audio file' });
    }
  });

  // Detect song mention in text and get features
  app.post("/api/music/detect-song", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text required' });
      }

      // Try to detect a song mention
      const detected = detectSongMention(message);

      if (!detected) {
        return res.json({ detected: false });
      }

      // Search Spotify for the track
      const accessToken = await getSpotifyAccessToken();

      if (!accessToken) {
        return res.json({
          detected: true,
          song: detected.song,
          artist: detected.artist,
          spotifyFound: false,
          message: 'Spotify not connected - cannot fetch audio features'
        });
      }

      // Search for the track on Spotify
      const searchQuery = `${detected.song} ${detected.artist}`;
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Spotify search failed');
      }

      const searchData = await searchResponse.json() as any;
      const track = searchData.tracks?.items?.[0];

      if (!track) {
        return res.json({
          detected: true,
          song: detected.song,
          artist: detected.artist,
          spotifyFound: false
        });
      }

      // Get audio features
      const featuresResponse = await fetch(
        `https://api.spotify.com/v1/audio-features/${track.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!featuresResponse.ok) {
        throw new Error('Failed to get audio features');
      }

      const features = await featuresResponse.json() as SpotifyAudioFeatures;

      // Translate to natural language
      const description = translateToNaturalLanguage(
        features,
        track.name,
        track.artists[0]?.name
      );

      Logger.info('music', 'Detected song mention', {
        song: detected.song,
        artist: detected.artist,
        spotifyTrackId: track.id
      });

      res.json({
        detected: true,
        song: detected.song,
        artist: detected.artist,
        spotifyFound: true,
        track: {
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name,
          album: track.album?.name,
          imageUrl: track.album?.images?.[0]?.url
        },
        features,
        description
      });
    } catch (error) {
      Logger.error('music', 'Failed to detect/process song', error as Error);
      res.status(500).json({ error: 'Failed to process song mention' });
    }
  });

  // Share music description with Kindroid
  app.post("/api/music/share-with-kindroid", async (req, res) => {
    try {
      const { description, trackName, artist, companionId } = req.body;

      if (!description) {
        return res.status(400).json({ error: 'Music description required' });
      }

      // Get companion's Kindroid credentials
      // Bot ID comes from companions table, API key comes from apiCredentials table
      const userId = 'default-user';
      let kindroidBotId: string | null = null;
      let kindroidApiKey: string | null = null;

      // Step 1: Get the API key from apiCredentials (service='kindroid')
      const kindroidCred = await db.select()
        .from(schema.apiCredentials)
        .where(and(
          eq(schema.apiCredentials.userId, userId),
          eq(schema.apiCredentials.service, 'kindroid'),
          eq(schema.apiCredentials.isActive, true)
        ))
        .limit(1);

      if (kindroidCred.length > 0) {
        kindroidApiKey = decrypt(kindroidCred[0].encryptedKey);
      }

      // Step 2: Get the Bot ID from companions table
      if (companionId) {
        // Get from specific companion
        const companion = await db.select()
          .from(schema.companions)
          .where(eq(schema.companions.id, companionId))
          .limit(1);

        if (companion.length > 0 && companion[0].kindroidBotId) {
          kindroidBotId = companion[0].kindroidBotId;
        }
      }

      if (!kindroidBotId) {
        // Try to get from active companion
        const activeCompanion = await db.select()
          .from(schema.companions)
          .where(and(
            eq(schema.companions.userId, userId),
            eq(schema.companions.isActive, true)
          ))
          .limit(1);

        if (activeCompanion.length > 0 && activeCompanion[0].kindroidBotId) {
          kindroidBotId = activeCompanion[0].kindroidBotId;
        }
      }

      if (!kindroidBotId) {
        // Try ANY companion with a Bot ID (not just active)
        const anyCompanion = await db.select()
          .from(schema.companions)
          .where(eq(schema.companions.userId, userId))
          .limit(10);

        for (const comp of anyCompanion) {
          if (comp.kindroidBotId) {
            kindroidBotId = comp.kindroidBotId;
            break;
          }
        }
      }

      if (!kindroidBotId || !kindroidApiKey) {
        return res.status(400).json({
          error: 'Kindroid not configured. Please set up a companion with Kindroid credentials.'
        });
      }

      // Format the message for Kindroid
      const formattedMessage = typeof description === 'string'
        ? description
        : formatForKindroid(description, true);

      // Send to Kindroid
      const kindroidUrl = process.env.KINDROID_API_URL || 'https://api.kindroid.ai/v1';
      const kindroidResponse = await fetch(`${kindroidUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kindroidApiKey}`
        },
        body: JSON.stringify({
          ai_id: kindroidBotId,
          message: formattedMessage
        })
      });

      if (!kindroidResponse.ok) {
        const errorText = await kindroidResponse.text();
        throw new Error(`Kindroid API error: ${errorText}`);
      }

      const kindroidReply = await kindroidResponse.text();

      Logger.info('music', 'Shared music with Kindroid', {
        trackName,
        artist,
        kindroidBotId
      });

      res.json({
        success: true,
        shared: {
          trackName,
          artist,
          description: formattedMessage
        },
        kindroidResponse: kindroidReply
      });
    } catch (error) {
      Logger.error('music', 'Failed to share with Kindroid', error as Error);
      res.status(500).json({ error: 'Failed to share music with Kindroid' });
    }
  });

  // Combined endpoint: detect song, get features, and share with Kindroid
  app.post("/api/music/share-song", async (req, res) => {
    try {
      const { message, trackId, trackName, artist, companionId, wavFilePath } = req.body;

      let description: any;
      let trackInfo: any = { name: trackName, artist };

      // Option 1: Analyze from WAV file path
      if (wavFilePath) {
        const features = await analyzeWavFile(wavFilePath);
        description = translateToNaturalLanguage(features, trackName || 'My Song', artist || 'Phoenix');
        trackInfo = { name: trackName || 'My Song', artist: artist || 'Phoenix' };
      }
      // Option 2: Get from Spotify track ID
      else if (trackId) {
        const accessToken = await getSpotifyAccessToken();
        if (!accessToken) {
          return res.status(401).json({ error: 'Spotify not connected' });
        }

        // Get track and features in parallel
        const [trackResponse, featuresResponse] = await Promise.all([
          fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }),
          fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
        ]);

        if (!trackResponse.ok || !featuresResponse.ok) {
          throw new Error('Failed to get track data from Spotify');
        }

        const track = await trackResponse.json() as any;
        const features = await featuresResponse.json() as SpotifyAudioFeatures;

        trackInfo = {
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name,
          album: track.album?.name,
          imageUrl: track.album?.images?.[0]?.url
        };

        description = translateToNaturalLanguage(features, track.name, track.artists[0]?.name);
      }
      // Option 3: Detect from message text
      else if (message) {
        const detected = detectSongMention(message);
        if (!detected) {
          return res.json({ detected: false, shared: false });
        }

        // Try to find on Spotify
        const accessToken = await getSpotifyAccessToken();
        if (accessToken) {
          const searchQuery = `${detected.song} ${detected.artist}`;
          const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json() as any;
            const track = searchData.tracks?.items?.[0];

            if (track) {
              const featuresResponse = await fetch(
                `https://api.spotify.com/v1/audio-features/${track.id}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );

              if (featuresResponse.ok) {
                const features = await featuresResponse.json() as SpotifyAudioFeatures;
                trackInfo = {
                  id: track.id,
                  name: track.name,
                  artist: track.artists[0]?.name,
                  album: track.album?.name
                };
                description = translateToNaturalLanguage(features, track.name, track.artists[0]?.name);
              }
            }
          }
        }

        // If Spotify lookup failed, use basic detection
        if (!description) {
          // Create a basic description without audio features
          description = {
            summary: `"${detected.song}" by ${detected.artist}`,
            details: `Phoenix is sharing "${detected.song}" by ${detected.artist} with you.`,
            mood: 'unknown',
            style: 'unknown',
            tempo: 'unknown'
          };
          trackInfo = { name: detected.song, artist: detected.artist };
        }
      } else {
        return res.status(400).json({ error: 'Provide message, trackId, or wavFilePath' });
      }

      // Now share with Kindroid
      // Bot ID comes from companions table, API key comes from apiCredentials table
      const userId = 'default-user';
      let kindroidBotId: string | null = null;
      let kindroidApiKey: string | null = null;

      // Step 1: Get the API key from apiCredentials (service='kindroid')
      const kindroidCred = await db.select()
        .from(schema.apiCredentials)
        .where(and(
          eq(schema.apiCredentials.userId, userId),
          eq(schema.apiCredentials.service, 'kindroid'),
          eq(schema.apiCredentials.isActive, true)
        ))
        .limit(1);

      if (kindroidCred.length > 0) {
        kindroidApiKey = decrypt(kindroidCred[0].encryptedKey);
      }

      // Step 2: Get the Bot ID from companions table
      if (companionId) {
        const companion = await db.select()
          .from(schema.companions)
          .where(eq(schema.companions.id, companionId))
          .limit(1);

        if (companion.length > 0 && companion[0].kindroidBotId) {
          kindroidBotId = companion[0].kindroidBotId;
        }
      }

      if (!kindroidBotId) {
        const activeCompanion = await db.select()
          .from(schema.companions)
          .where(and(
            eq(schema.companions.userId, userId),
            eq(schema.companions.isActive, true)
          ))
          .limit(1);

        if (activeCompanion.length > 0 && activeCompanion[0].kindroidBotId) {
          kindroidBotId = activeCompanion[0].kindroidBotId;
        }
      }

      if (!kindroidBotId || !kindroidApiKey) {
        return res.json({
          detected: true,
          track: trackInfo,
          description,
          shared: false,
          reason: 'No Kindroid configured'
        });
      }

      // Send to Kindroid
      const kindroidUrl = process.env.KINDROID_API_URL || 'https://api.kindroid.ai/v1';
      const formattedMessage = formatForKindroid(description, true);

      const kindroidResponse = await fetch(`${kindroidUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kindroidApiKey}`
        },
        body: JSON.stringify({
          ai_id: kindroidBotId,
          message: formattedMessage
        })
      });

      const kindroidReply = kindroidResponse.ok ? await kindroidResponse.text() : null;

      Logger.info('music', 'Shared song with Kindroid', {
        track: trackInfo.name,
        artist: trackInfo.artist
      });

      res.json({
        detected: true,
        track: trackInfo,
        description,
        shared: true,
        kindroidResponse: kindroidReply
      });
    } catch (error) {
      Logger.error('music', 'Failed to share song', error as Error);
      res.status(500).json({ error: 'Failed to share song' });
    }
  });

  // --- END MUSIC SHARING ROUTES ---

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

  // WebSocket endpoint for Twilio Media Streams
  const mediaStreamWss = new WebSocketServer({ noServer: true });

  mediaStreamWss.on('error', (error) => {
    Logger.error('twilio', 'WebSocket server error', error as Error);
  });

  httpServer.on('upgrade', (request, socket, head) => {
    Logger.info('twilio', `HTTP upgrade request received`, {
      url: request.url,
      headers: {
        upgrade: request.headers.upgrade,
        connection: request.headers.connection,
        host: request.headers.host
      }
    });

    // Add socket error handler
    socket.on('error', (error) => {
      Logger.error('twilio', 'Socket error during upgrade', error as Error);
    });

    if (request.url === '/ws') {
      // Handle regular WebSocket connections for dashboard updates
      Logger.info('websocket', 'Accepting /ws WebSocket upgrade');
      wss.handleUpgrade(request, socket, head, (ws) => {
        Logger.info('websocket', '/ws WebSocket upgraded successfully');
        wss.emit('connection', ws, request);
      });
    } else if (request.url === '/webhooks/twilio/media-stream') {
      Logger.info('twilio', 'Accepting media stream WebSocket upgrade', {
        headLength: head.length,
        socketReadable: socket.readable,
        socketWritable: socket.writable,
        socketDestroyed: socket.destroyed,
        socketPending: (socket as any).pending
      });

      // Set a timeout to detect if callback is never called
      const timeoutId = setTimeout(() => {
        Logger.error('twilio', 'handleUpgrade callback timeout - callback was never called after 5 seconds', new Error('Upgrade timeout'));
      }, 5000);

      mediaStreamWss.handleUpgrade(request, socket, head, (ws) => {
        clearTimeout(timeoutId);
        Logger.info('twilio', 'Media stream WebSocket upgraded successfully');
        ws.on('error', (error) => {
          Logger.error('twilio', 'WebSocket connection error', error as Error);
        });
        mediaStreamWss.emit('connection', ws, request);
      });
      Logger.info('twilio', 'handleUpgrade called, waiting for callback');
    } else {
      Logger.warn('twilio', `Unhandled HTTP upgrade request for URL: ${request.url}`, { error: new Error('Unhandled upgrade request') });
      socket.destroy();
    }
  });

  mediaStreamWss.on('connection', async (ws, request) => {
    Logger.info('twilio', 'Media stream WebSocket connected');

    // Add error and close handlers
    ws.on('error', (error) => {
      Logger.error('twilio', 'Media stream WebSocket error in routes', error as Error);
    });

    ws.on('close', (code, reason) => {
      Logger.info('twilio', 'Media stream WebSocket closed in routes', { code, reason: reason.toString() });
    });

    // Listen for messages until we get the 'start' event
    const messageHandler = async (message: string) => {
      Logger.info('twilio', 'Message received on media stream', {
        messagePreview: message.toString().substring(0, 150),
        event: JSON.parse(message).event
      });
      try {
        const data = JSON.parse(message);

        if (data.event === 'start') {
          // Remove this handler since we only need to process 'start' once
          ws.off('message', messageHandler);
          const callSid = data.start.callSid;
          const customParameters = data.start.customParameters;

          Logger.info('twilio', 'Media stream start event received', {
            callSid,
            streamSid: data.start.streamSid,
            companionId: customParameters?.companionId
          });

          // Initialize AI session if companion is configured
          if (customParameters?.companionId) {
            const companions = await storage.getCompanions("default-user");
            const companion = companions.find(c => c.id === customParameters.companionId);

            if (companion && process.env.ELEVENLABS_API_KEY && process.env.KINDROID_API_KEY && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
              Logger.info('twilio', 'All AI services configured, initializing session', { callSid, companionId: companion.id });

              // Initialize session and store WebSocket reference
              initializeSession(
                callSid,
                companion,
                process.env.ELEVENLABS_API_KEY,
                process.env.KINDROID_API_KEY,
                process.env.AWS_REGION || 'us-east-1',
                process.env.AWS_ACCESS_KEY_ID,
                process.env.AWS_SECRET_ACCESS_KEY
              );

              // Call handleMediaStream which will set up its own message handlers
              handleMediaStream(ws, callSid);

              // Manually trigger the stream start since we already consumed the first message
              // The handleMediaStream's message handler won't see this first 'start' event
              ws.emit('message', message);
            } else {
              Logger.warn('twilio', 'AI services not fully configured', {
                error: 'AI services not fully configured',
                hasCompanion: !!companion,
                hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
                hasKindroid: !!process.env.KINDROID_API_KEY,
                hasAWS: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY
              });
            }
          } else {
            Logger.warn('twilio', 'No companion ID provided in custom parameters for media stream', { callSid, customParameters, error: 'No companion ID' });
          }
        }
      } catch (error) {
        Logger.error('twilio', 'Media stream message error', error as Error);
      }
    };

    // Attach the message handler
    ws.on('message', messageHandler);
  });

  return httpServer;
}
