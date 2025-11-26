# AWS Transcribe to AssemblyAI Migration Patch for SoulSync

This patch converts your SoulSync project from AWS Transcribe to AssemblyAI for real-time speech transcription.

## Prerequisites

### 1. Get AssemblyAI API Key
1. Sign up at https://www.assemblyai.com/
2. Go to your dashboard and copy your API key
3. Add to your `.env` file:
```bash
ASSEMBLYAI_API_KEY=your_api_key_here
```

### 2. Install AssemblyAI SDK
Run this command in your project root:
```bash
npm install assemblyai
```

### 3. Remove AWS SDK (Optional - to reduce bundle size)
```bash
npm uninstall @aws-sdk/client-transcribe-streaming
```

---

## File Changes

### FILE 1: `package.json`

**REMOVE this line:**
```json
"@aws-sdk/client-transcribe-streaming": "^3.916.0",
```

**ADD this line:**
```json
"assemblyai": "^4.8.2",
```

Your dependencies section should look like:
```json
"dependencies": {
  "assemblyai": "^4.8.2",
  "@google-cloud/text-to-speech": "^6.3.0",
  // ... rest of dependencies
}
```

---

### FILE 2: `server/ai-voice-service.ts`

#### Change 1: Update Imports (Lines 1-10)

**REMOVE these lines:**
```typescript
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';
```

**REPLACE WITH:**
```typescript
import { RealtimeTranscriber } from 'assemblyai';
```

So your imports should look like:
```typescript
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { Logger } from './logger.js';
import { RealtimeTranscriber } from 'assemblyai';
import textToSpeech from '@google-cloud/text-to-speech';
import alawmulawPkg from 'alawmulaw';
const { mulaw } = alawmulawPkg;
```

#### Change 2: Update ConversationSession Interface (Lines 17-36)

**FIND:**
```typescript
interface ConversationSession {
  companionId: string;
  kindroidBotId: string;
  kindroidApiKey: string;
  voiceId: string;
  elevenlabsApiKey: string;
  conversationHistory: KindroidMessage[];
  callSid: string;
  transcribeClient?: TranscribeStreamingClient;
  isTranscribing?: boolean;
  // ... rest of properties
}
```

**REPLACE `transcribeClient` line with:**
```typescript
interface ConversationSession {
  companionId: string;
  kindroidBotId: string;
  kindroidApiKey: string;
  voiceId: string;
  elevenlabsApiKey: string;
  conversationHistory: KindroidMessage[];
  callSid: string;
  transcriber?: RealtimeTranscriber;
  isTranscribing?: boolean;
  // ... rest of properties stays the same
}
```

#### Change 3: Update initializeSession Function (Lines 43-85)

**FIND the entire function:**
```typescript
export function initializeSession(
  callSid: string,
  companion: any,
  elevenlabsApiKey: string,
  kindroidApiKey: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string
) {
  const transcribeClient = new TranscribeStreamingClient({
    region: awsRegion || 'us-east-1',
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    }
  });

  const newSession: ConversationSession = {
    companionId: companion.id,
    kindroidBotId: companion.kindroidBotId,
    kindroidApiKey,
    voiceId: companion.voiceId,
    elevenlabsApiKey,
    conversationHistory: [],
    callSid,
    transcribeClient,
    isTranscribing: false,
    isProcessing: false,
    audioBuffer: [],
    initialGreetingSent: false,
    accumulatedTranscript: '',
    lastTranscriptTime: Date.now(),
  };
  sessions.set(callSid, newSession);

  Logger.info('ai-voice', 'Session initialized', { callSid, companionId: companion.id });
  (Logger.debug as any)('ai-voice', 'Session details', {
    voiceId: newSession.voiceId,
    hasElevenlabsKey: !!newSession.elevenlabsApiKey,
    hasKindroidKey: !!newSession.kindroidApiKey,
    hasAWSCredentials: !!awsAccessKeyId && !!awsSecretAccessKey,
  });
}
```

**REPLACE WITH:**
```typescript
export function initializeSession(
  callSid: string,
  companion: any,
  elevenlabsApiKey: string,
  kindroidApiKey: string,
  assemblyaiApiKey: string
) {
  // Note: We'll create the transcriber when the stream starts, not here
  const newSession: ConversationSession = {
    companionId: companion.id,
    kindroidBotId: companion.kindroidBotId,
    kindroidApiKey,
    voiceId: companion.voiceId,
    elevenlabsApiKey,
    conversationHistory: [],
    callSid,
    transcriber: undefined,
    isTranscribing: false,
    isProcessing: false,
    audioBuffer: [],
    initialGreetingSent: false,
    accumulatedTranscript: '',
    lastTranscriptTime: Date.now(),
  };
  sessions.set(callSid, newSession);

  Logger.info('ai-voice', 'Session initialized', { callSid, companionId: companion.id });
  (Logger.debug as any)('ai-voice', 'Session details', {
    voiceId: newSession.voiceId,
    hasElevenlabsKey: !!newSession.elevenlabsApiKey,
    hasKindroidKey: !!newSession.kindroidApiKey,
    hasAssemblyAIKey: !!assemblyaiApiKey,
  });
}
```

#### Change 4: Replace AWS Transcribe Logic in handleMediaStream (Lines 460-565)

**FIND the `startTranscription` function inside `handleMediaStream`:**
```typescript
  // Start AWS Transcribe streaming
  const startTranscription = async () => {
    if (transcriptionActive) return;

    transcriptionActive = true;
    session.isTranscribing = true;
    session.accumulatedTranscript = '';

    Logger.info('ai-voice', 'Starting AWS Transcribe streaming', { callSid });

    // Audio stream generator for AWS Transcribe
    const audioGenerator = async function* () {
      try {
        while (session.isTranscribing && audioChunks.length >= 0) {
          if (audioChunks.length > 0) {
            const chunk = audioChunks.shift();
            if (chunk) {
              yield { AudioEvent: { AudioChunk: chunk } };
            }
          } else {
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }
      } catch (error) {
        Logger.error('ai-voice', 'Audio generator error', error as Error);
      }
    };

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 8000, // Twilio sends 8kHz mulaw
      AudioStream: audioGenerator(),
    });

    try {
      const response = await session.transcribeClient!.send(command);
      Logger.info('ai-voice', 'AWS Transcribe connection opened', { callSid });

      // Start initial silence timer
      resetSilenceTimer();

      // Process transcription results
      for await (const event of response.TranscriptResultStream!) {
        if (!session.isTranscribing) break;

        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results;

          if (results && results.length > 0) {
            for (const result of results) {
              if (result.Alternatives && result.Alternatives.length > 0) {
                const transcript = result.Alternatives[0].Transcript;

                if (transcript && transcript.trim()) {
                  // Speech detected - reset silence timer
                  session.lastTranscriptTime = Date.now();
                  resetSilenceTimer();

                  // Only accumulate final results
                  if (!result.IsPartial) {
                    session.accumulatedTranscript = (session.accumulatedTranscript || '') + transcript + ' ';
                    Logger.info('ai-voice', 'AWS Transcribe final result', {
                      callSid,
                      transcript,
                      accumulated: session.accumulatedTranscript
                    });
                  } else {
                    (Logger.debug as any)('ai-voice', 'AWS Transcribe partial result', {
                      callSid,
                      transcript
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Cleanup
      if (session.silenceTimer) {
        clearTimeout(session.silenceTimer);
      }

      if (session.accumulatedTranscript && session.accumulatedTranscript.trim()) {
        await sendBatch();
      }

      Logger.info('ai-voice', 'AWS Transcribe connection closed', { callSid });
    } catch (error) {
      Logger.error('ai-voice', 'AWS Transcribe error', error as Error);

      if (session.silenceTimer) {
        clearTimeout(session.silenceTimer);
      }

      if (session.accumulatedTranscript && session.accumulatedTranscript.trim()) {
        await sendBatch();
      }
    } finally {
      transcriptionActive = false;
      session.isTranscribing = false;
    }
  };
```

**REPLACE WITH:**
```typescript
  // Start AssemblyAI Realtime Transcription
  const startTranscription = async () => {
    if (transcriptionActive) return;

    transcriptionActive = true;
    session.isTranscribing = true;
    session.accumulatedTranscript = '';

    Logger.info('ai-voice', 'Starting AssemblyAI Realtime Transcription', { callSid });

    try {
      // Create new transcriber
      const transcriber = new RealtimeTranscriber({
        apiKey: process.env.ASSEMBLYAI_API_KEY!,
        sampleRate: 8000,
        encoding: 'pcm_s16le' // 16-bit PCM little-endian
      });

      session.transcriber = transcriber;

      // Set up event handlers
      transcriber.on('open', ({ sessionId }) => {
        Logger.info('ai-voice', 'AssemblyAI connection opened', { callSid, sessionId });
        resetSilenceTimer();
      });

      transcriber.on('transcript', (transcript) => {
        if (!session.isTranscribing) return;

        // Only process final transcripts
        if (transcript.message_type === 'FinalTranscript') {
          const text = transcript.text;
          
          if (text && text.trim()) {
            // Speech detected - reset silence timer
            session.lastTranscriptTime = Date.now();
            resetSilenceTimer();

            session.accumulatedTranscript = (session.accumulatedTranscript || '') + text + ' ';
            Logger.info('ai-voice', 'AssemblyAI final transcript', {
              callSid,
              transcript: text,
              accumulated: session.accumulatedTranscript
            });
          }
        } else if (transcript.message_type === 'PartialTranscript') {
          (Logger.debug as any)('ai-voice', 'AssemblyAI partial transcript', {
            callSid,
            transcript: transcript.text
          });
        }
      });

      transcriber.on('error', (error) => {
        Logger.error('ai-voice', 'AssemblyAI error', error);
      });

      transcriber.on('close', async (code, reason) => {
        Logger.info('ai-voice', 'AssemblyAI connection closed', { callSid, code, reason });
        
        // Cleanup
        if (session.silenceTimer) {
          clearTimeout(session.silenceTimer);
        }

        if (session.accumulatedTranscript && session.accumulatedTranscript.trim()) {
          await sendBatch();
        }

        transcriptionActive = false;
        session.isTranscribing = false;
      });

      // Connect to AssemblyAI
      await transcriber.connect();
      Logger.info('ai-voice', 'Connected to AssemblyAI', { callSid });

    } catch (error) {
      Logger.error('ai-voice', 'Failed to start AssemblyAI transcription', error as Error);
      transcriptionActive = false;
      session.isTranscribing = false;
    }
  };
```

#### Change 5: Update Audio Handling in Media Event (Lines 617-644)

**FIND:**
```typescript
        case 'media':
          // Convert mulaw audio from Twilio to PCM for AWS Transcribe
          if (data.media?.payload) {
            const mulawData = Buffer.from(data.media.payload, 'base64');

            // Decode mulaw to 16-bit PCM (returns Int16Array)
            const pcmData = mulaw.decode(new Uint8Array(mulawData));

            // Convert Int16Array to Buffer
            const pcmBuffer = Buffer.from(pcmData.buffer);

            // Add to audio chunks for transcription
            audioChunks.push(pcmBuffer);

            // Log first few media packets to verify audio is flowing
            if (!(session as any).mediaPacketCount) (session as any).mediaPacketCount = 0;
            (session as any).mediaPacketCount++;
            if ((session as any).mediaPacketCount <= 3) {
              Logger.info('ai-voice', 'Audio buffered for AWS Transcribe', {
                callSid,
                packetNum: (session as any).mediaPacketCount,
                mulawSize: mulawData.length,
                pcmSize: pcmBuffer.length,
                bufferQueueSize: audioChunks.length
              });
            }
          }
          break;
```

**REPLACE WITH:**
```typescript
        case 'media':
          // Convert mulaw audio from Twilio to PCM for AssemblyAI
          if (data.media?.payload && session.transcriber) {
            const mulawData = Buffer.from(data.media.payload, 'base64');

            // Decode mulaw to 16-bit PCM (returns Int16Array)
            const pcmData = mulaw.decode(new Uint8Array(mulawData));

            // Convert Int16Array to Buffer
            const pcmBuffer = Buffer.from(pcmData.buffer);

            // Send audio directly to AssemblyAI
            try {
              session.transcriber.sendAudio(pcmBuffer);
            } catch (error) {
              Logger.error('ai-voice', 'Failed to send audio to AssemblyAI', error as Error);
            }

            // Log first few media packets to verify audio is flowing
            if (!(session as any).mediaPacketCount) (session as any).mediaPacketCount = 0;
            (session as any).mediaPacketCount++;
            if ((session as any).mediaPacketCount <= 3) {
              Logger.info('ai-voice', 'Audio sent to AssemblyAI', {
                callSid,
                packetNum: (session as any).mediaPacketCount,
                mulawSize: mulawData.length,
                pcmSize: pcmBuffer.length
              });
            }
          }
          break;
```

#### Change 6: Update Session Cleanup (Line 648)

**FIND:**
```typescript
        case 'stop':
          Logger.info('ai-voice', 'Stream stopped', { callSid });
          session.isTranscribing = false;
          endSession(callSid);
          break;
```

**REPLACE WITH:**
```typescript
        case 'stop':
          Logger.info('ai-voice', 'Stream stopped', { callSid });
          session.isTranscribing = false;
          if (session.transcriber) {
            await session.transcriber.close();
          }
          endSession(callSid);
          break;
```

#### Change 7: Update WebSocket Close Handler (Line 657)

**FIND:**
```typescript
  ws.on('close', () => {
    Logger.info('ai-voice', 'Media stream closed', { callSid });
    session.isTranscribing = false;
    endSession(callSid);
  });
```

**REPLACE WITH:**
```typescript
  ws.on('close', async () => {
    Logger.info('ai-voice', 'Media stream closed', { callSid });
    session.isTranscribing = false;
    if (session.transcriber) {
      await session.transcriber.close();
    }
    endSession(callSid);
  });
```

---

### FILE 3: `server/routes.ts`

#### Change 1: Update Environment Variable Checks

**FIND (around line 373-374):**
```typescript
process.env.AWS_ACCESS_KEY_ID &&
process.env.AWS_SECRET_ACCESS_KEY;
```

**REPLACE WITH:**
```typescript
process.env.ASSEMBLYAI_API_KEY;
```

**FIND (around line 398):**
```typescript
hasAWS: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY
```

**REPLACE WITH:**
```typescript
hasAssemblyAI: !!process.env.ASSEMBLYAI_API_KEY
```

#### Change 2: Update initializeSession Call (around lines 943-954)

**FIND:**
```typescript
if (companion && process.env.ELEVENLABS_API_KEY && process.env.KINDROID_API_KEY && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  Logger.info('twilio', 'Initializing session', {
    callSid,
    companionId: companion.id,
    voiceId: companion.voiceId
  });
  
  initializeSession(
    callSid,
    companion,
    process.env.ELEVENLABS_API_KEY,
    process.env.KINDROID_API_KEY,
    process.env.AWS_REGION || 'us-east-1',
    process.env.AWS_ACCESS_KEY_ID,
    process.env.AWS_SECRET_ACCESS_KEY
  );
```

**REPLACE WITH:**
```typescript
if (companion && process.env.ELEVENLABS_API_KEY && process.env.KINDROID_API_KEY && process.env.ASSEMBLYAI_API_KEY) {
  Logger.info('twilio', 'Initializing session', {
    callSid,
    companionId: companion.id,
    voiceId: companion.voiceId
  });
  
  initializeSession(
    callSid,
    companion,
    process.env.ELEVENLABS_API_KEY,
    process.env.KINDROID_API_KEY,
    process.env.ASSEMBLYAI_API_KEY
  );
```

#### Change 3: Update hasAWS Check (around line 969)

**FIND:**
```typescript
hasAWS: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY
```

**REPLACE WITH:**
```typescript
hasAssemblyAI: !!process.env.ASSEMBLYAI_API_KEY
```

---

### FILE 4: `.env` (Environment Variables)

**REMOVE these lines:**
```bash
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
```

**ADD this line:**
```bash
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

---

## Summary of Changes

### Dependencies Changed:
- ❌ Removed: `@aws-sdk/client-transcribe-streaming`
- ✅ Added: `assemblyai`

### Files Modified:
1. ✅ `package.json` - Updated dependencies
2. ✅ `server/ai-voice-service.ts` - Replaced AWS Transcribe with AssemblyAI
3. ✅ `server/routes.ts` - Updated environment variable checks
4. ✅ `.env` - Replaced AWS credentials with AssemblyAI API key

### Key Benefits of AssemblyAI:
- ✅ **Simpler API** - No complex streaming setup
- ✅ **Better accuracy** - Industry-leading speech recognition
- ✅ **Lower latency** - Real-time transcription optimized for conversations
- ✅ **Free tier available** - 5 hours of audio/month free
- ✅ **Single API key** - No AWS account management needed

---

## Installation Steps

1. **Install AssemblyAI:**
```bash
npm install assemblyai
```

2. **Remove AWS SDK (optional):**
```bash
npm uninstall @aws-sdk/client-transcribe-streaming
```

3. **Update your environment variables in `.env`:**
```bash
ASSEMBLYAI_API_KEY=your_api_key_here
```

4. **Apply all code changes from this patch file**

5. **Rebuild and restart:**
```bash
npm run build
npm start
```

---

## Testing

After applying the patch:

1. Make a test call to your SoulSync companion
2. Check logs for "AssemblyAI connection opened"
3. Speak into the phone and verify transcription is working
4. Confirm AI responses are generated correctly

---

## Troubleshooting

### "ASSEMBLYAI_API_KEY is not defined"
- Make sure you added the API key to your `.env` file
- Restart your server after adding the key

### "Failed to connect to AssemblyAI"
- Check your API key is valid
- Ensure you have internet connectivity
- Check AssemblyAI service status

### "Audio not being transcribed"
- Verify audio is being sent (check logs for "Audio sent to AssemblyAI")
- Confirm PCM audio format is correct
- Check AssemblyAI dashboard for API usage

### Need Help?
- AssemblyAI Docs: https://www.assemblyai.com/docs/
- AssemblyAI Discord: https://discord.gg/assemblyai

---

## Cost Comparison

### AWS Transcribe:
- $0.02400 per minute (streaming)
- ~$1.44/hour
- ~$43.20 for 30 hours/month

### AssemblyAI:
- **FREE: 5 hours/month**
- After free tier: $0.00037/second = $1.33/hour
- ~$39.90 for 30 hours/month (after free 5 hours)

**Your usage (110k characters = ~4-6 hours):**
- Fits within free tier! 🎉
- $0/month for your current usage

---

## Questions?

If you encounter any issues applying this patch, let me know which step is causing problems!
