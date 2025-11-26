import WebSocket from 'ws';
import fetch from 'node-fetch';
import { Logger } from './logger.js';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import textToSpeech from '@google-cloud/text-to-speech';
import alawmulawPkg from 'alawmulaw';
const { mulaw } = alawmulawPkg;

interface KindroidMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationSession {
  companionId: string;
  kindroidBotId: string;
  kindroidApiKey: string;
  voiceId: string;
  elevenlabsApiKey: string;
  conversationHistory: KindroidMessage[];
  callSid: string;
  deepgramConnection?: any; // Deepgram live connection
  isTranscribing?: boolean;
  isAISpeaking?: boolean; // Flag to pause transcription while AI speaks
  twilioWs?: WebSocket;
  streamSid?: string;
  isProcessing: boolean;
  audioBuffer: Buffer[]; // Change to Buffer[] to store raw audio chunks
  initialGreetingSent: boolean; // New flag to track if greeting has been sent
  accumulatedTranscript?: string;
  lastTranscriptTime?: number;
  silenceTimer?: NodeJS.Timeout;
}

const sessions = new Map<string, ConversationSession>();

/**
 * Upsample PCM audio from 8kHz to 16kHz using linear interpolation
 */
function upsample8kTo16k(input: Int16Array): Int16Array {
  const output = new Int16Array(input.length * 2);

  for (let i = 0; i < input.length - 1; i++) {
    output[i * 2] = input[i];
    // Linear interpolation between samples
    output[i * 2 + 1] = Math.round((input[i] + input[i + 1]) / 2);
  }

  // Handle last sample
  output[output.length - 2] = input[input.length - 1];
  output[output.length - 1] = input[input.length - 1];

  return output;
}

/**
 * Initialize a conversation session for a call
 */
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
    deepgramConnection: undefined,
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

/**
 * Send user speech to Kindroid AI and get response
 */
export async function getAIResponse(callSid: string, userMessage: string): Promise<string> {
  const session = sessions.get(callSid);

  if (!session) {
    throw new Error('Session not found');
  }

  // Add user message to history
  session.conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  try {
    // Call Kindroid API
    const kindroidStart = Date.now();
    (Logger.debug as any)('ai-voice', 'Calling Kindroid API', { callSid, botId: session.kindroidBotId, message: userMessage.substring(0, 50) });
    const response = await fetch(`${process.env.KINDROID_API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.kindroidApiKey}`
      },
      body: JSON.stringify({
        ai_id: session.kindroidBotId,
        message: userMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error('ai-voice', `Kindroid API error for call ${callSid}: ${response.statusText} - ${errorText}`, new Error(`Kindroid API error: ${response.statusText} - ${errorText}`));
      throw new Error(`Kindroid API error: ${response.statusText} - ${errorText}`);
    }

    // Kindroid returns plain text, not JSON
    const aiResponse = await response.text();

    // Add AI response to history
    session.conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    });

    Logger.info('ai-voice', 'AI response generated', {
      callSid,
      kindroidLatencyMs: Date.now() - kindroidStart,
      userMessage: userMessage.substring(0, 50),
      aiResponse: aiResponse.substring(0, 50)
    });

    return aiResponse;
  } catch (error) {
    Logger.error('ai-voice', `Failed to get AI response for call ${callSid}`, error as Error);
    throw error;
  }
}

/**
 * Convert text to speech using ElevenLabs and send to Twilio
 */
/**
 * Fallback TTS using Google Cloud Text-to-Speech
 */
async function speakWithGoogleTTS(callSid: string, text: string): Promise<void> {
  const session = sessions.get(callSid);
  if (!session?.twilioWs || !session.streamSid) return;

  try {
    Logger.info('ai-voice', 'Using Google Cloud TTS fallback', { callSid, textLength: text.length });

    // Create credentials from base64 env var or JSON string
    const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64
      ? JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64, 'base64').toString())
      : process.env.GOOGLE_CLOUD_CREDENTIALS
      ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
      : undefined;

    if (!credentials) {
      Logger.error('ai-voice', 'Google Cloud credentials not configured', new Error('Missing credentials'));
      return;
    }

    // Initialize Google Cloud TTS client
    const client = new textToSpeech.TextToSpeechClient({ credentials });

    // Prepare the text-to-speech request
    const request = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Chirp3-HD-Aoede', // Chirp3 HD voice - high quality
        ssmlGender: 'FEMALE' as const
      },
      audioConfig: {
        audioEncoding: 'MULAW' as const, // μ-law format for Twilio
        sampleRateHertz: 8000 // 8kHz for phone calls
      },
    };

    // Generate speech
    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    // Convert to base64 for Twilio
    const audioPayload = Buffer.from(response.audioContent).toString('base64');

    // Send audio to Twilio Media Stream
    const mediaMessage = {
      event: 'media',
      streamSid: session.streamSid,
      media: {
        payload: audioPayload
      }
    };

    session.twilioWs.send(JSON.stringify(mediaMessage));

    Logger.info('ai-voice', 'Google TTS audio sent to Twilio', {
      callSid,
      textLength: text.length,
      audioSize: response.audioContent.length
    });
  } catch (error) {
    Logger.error('ai-voice', `Failed Google Cloud TTS for call ${callSid}`, error as Error);
  }
}

export async function speakResponse(callSid: string, text: string): Promise<void> {
  const session = sessions.get(callSid);

  if (!session) {
    Logger.error('ai-voice', `Cannot speak for call ${callSid} - session not found.`, new Error('Session not found'));
    return;
  }

  if (!session.twilioWs || !session.streamSid) {
    Logger.error('ai-voice', `Cannot speak for call ${callSid} - Twilio WebSocket or stream SID not ready. TwilioWs: ${!!session.twilioWs}, StreamSid: ${!!session.streamSid}`, new Error('Twilio connection not ready'));
    return;
  }

  const fallbackVoiceId = 'v8DWAeuEGQSfwxqdH9t2'; // Free tier compatible voice
  let voiceIdToUse = session.voiceId;

  try {
    const ttsStart = Date.now();
    Logger.info('ai-voice', 'Calling ElevenLabs TTS', { callSid, textLength: text.length, voiceId: voiceIdToUse });
    // Get audio from ElevenLabs - use query parameter for output format
    let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIdToUse}?output_format=ulaw_8000`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': session.elevenlabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Check if it's an instant voice cloning permission error
      if (errorText.includes('ivc_not_permitted') || errorText.includes('instant')) {
        Logger.warn('ai-voice', `Primary voice not permitted, trying fallback voice ${fallbackVoiceId}`, { callSid });

        // Retry with fallback voice
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoiceId}?output_format=ulaw_8000`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': session.elevenlabsApiKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          const fallbackErrorText = await response.text();
          Logger.error('ai-voice', `ElevenLabs fallback voice also failed for call ${callSid}: ${response.statusText} - ${fallbackErrorText}`, new Error(`ElevenLabs fallback error: ${response.statusText}`));
          await speakWithGoogleTTS(callSid, text);
          return;
        }

        voiceIdToUse = fallbackVoiceId;
      } else {
        Logger.error('ai-voice', `ElevenLabs API error for call ${callSid}: ${response.statusText} - ${errorText}`, new Error(`ElevenLabs API error: ${response.statusText} - ${errorText}`));
        await speakWithGoogleTTS(callSid, text);
        return;
      }
    }

    const audioBuffer = await response.buffer();

    // Log first bytes to debug audio format
    Logger.info('ai-voice', 'ElevenLabs audio buffer received', {
      callSid,
      ttsLatencyMs: Date.now() - ttsStart,
      audioSize: audioBuffer.length,
      firstBytes: audioBuffer.slice(0, 10).toString('hex')
    });

    // Convert to base64 for Twilio
    const audioPayload = audioBuffer.toString('base64');

    // Send audio to Twilio Media Stream
    const mediaMessage = {
      event: 'media',
      streamSid: session.streamSid,
      media: {
        payload: audioPayload
      }
    };

    session.twilioWs.send(JSON.stringify(mediaMessage));

    Logger.info('ai-voice', 'Audio sent to Twilio', {
      callSid,
      textLength: text.length,
      audioSize: audioBuffer.length
    });
  } catch (error) {
    Logger.error('ai-voice', `Failed to speak response for call ${callSid}`, error as Error);
    // Fallback to Google Cloud TTS on any error
    Logger.warn('ai-voice', 'Falling back to Google Cloud TTS after error', { callSid });
    await speakWithGoogleTTS(callSid, text);
  }
}

/**
 * Process user speech and respond
 */
async function processUserSpeech(callSid: string, transcript: string) {
  const session = sessions.get(callSid);

  if (!session || session.isProcessing) {
    return;
  }

  session.isProcessing = true;
  const totalStart = Date.now();

  try {
    Logger.info('ai-voice', 'Processing user speech', { callSid, transcript });

    // Get AI response from Kindroid
    const aiResponse = await getAIResponse(callSid, transcript);

    // Convert to speech and send back
    await speakResponse(callSid, aiResponse);

    Logger.info('ai-voice', 'Total speech processing complete', { callSid, totalLatencyMs: Date.now() - totalStart });

  } catch (error) {
    Logger.error('ai-voice', `Failed to process user speech for call ${callSid}`, error as Error);

    // Send error message
    try {
      await speakResponse(callSid, "I'm sorry, I'm having trouble understanding right now.");
    } catch (e) {
      // Ignore
    }
  } finally {
    session.isProcessing = false;
  }
}

/**
 * Clean up session when call ends
 */
export function endSession(callSid: string) {
  const session = sessions.get(callSid);

  if (session) {
    // Clear Twilio keep-alive interval
    if ((session as any).keepAliveInterval) {
      clearInterval((session as any).keepAliveInterval);
    }

    // Clear silence timer
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
    }

    // Stop transcription
    if (session.isTranscribing) {
      session.isTranscribing = false;
    }

    // Send any remaining transcript
    if (session.accumulatedTranscript && session.accumulatedTranscript.trim()) {
      processUserSpeech(callSid, session.accumulatedTranscript.trim()).catch(err => {
        Logger.error('ai-voice', 'Failed to process final transcript', err as Error);
      });
    }

    Logger.info('ai-voice', 'Session ended', {
      callSid,
      messageCount: session.conversationHistory.length
    });
    sessions.delete(callSid);
  }
}

/**
 * Handle incoming audio stream from Twilio Media Streams with AWS Transcribe STT
 */
export function handleMediaStream(ws: WebSocket, callSid: string) {
  const session = sessions.get(callSid);

  if (!session) {
    Logger.error('ai-voice', `Session not found for media stream: ${callSid}`, new Error('Session not found'));
    return;
  }

  session.twilioWs = ws;
  Logger.info('ai-voice', 'Media stream connected', { callSid });

  const SILENCE_THRESHOLD_MS = 2000; // 2 seconds of silence before sending batch
  let transcriptionActive = false;

  // Helper function to send accumulated transcript batch
  const sendBatch = async () => {
    if (session.accumulatedTranscript && session.accumulatedTranscript.trim()) {
      const batch = session.accumulatedTranscript.trim();
      session.accumulatedTranscript = '';

      if (session.silenceTimer) {
        clearTimeout(session.silenceTimer);
        session.silenceTimer = undefined;
      }

      Logger.info('ai-voice', 'Sending transcript batch after silence', { callSid, batch });
      await processUserSpeech(callSid, batch);
    }
  };

  // Helper function to reset silence timer
  const resetSilenceTimer = () => {
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
    }

    // Start new silence timer
    session.silenceTimer = setTimeout(async () => {
      Logger.info('ai-voice', `${SILENCE_THRESHOLD_MS}ms of silence detected, sending batch`, { callSid });
      await sendBatch();
    }, SILENCE_THRESHOLD_MS);
  };

  // Start AssemblyAI Realtime Transcription
  const startTranscription = async () => {
    if (transcriptionActive) return;

    transcriptionActive = true;
    session.isTranscribing = true;
    session.accumulatedTranscript = '';

    Logger.info('ai-voice', 'Starting Deepgram Streaming Transcription with Flux model', { callSid });

    try {
      // Create Deepgram client
      const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

      // Start live transcription connection with Flux model
      const connection = deepgram.listen.live({
        model: 'flux-general-en',
        language: 'en',
        encoding: 'linear16',
        sample_rate: 16000, // We'll upsample 8kHz to 16kHz
        channels: 1,
        interim_results: false, // Only final results
        endpointing: 300, // End utterance after 300ms of silence
        punctuate: true,
        smart_format: true
      });

      session.deepgramConnection = connection;

      // Set up event handlers
      connection.on(LiveTranscriptionEvents.Open, () => {
        Logger.info('ai-voice', 'Deepgram connection opened', { callSid });
        (session as any).deepgramReady = true;
        resetSilenceTimer();
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        if (!session.isTranscribing) return;

        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;

        if (isFinal && transcript && transcript.trim()) {
          // Speech detected - reset silence timer
          session.lastTranscriptTime = Date.now();
          resetSilenceTimer();

          session.accumulatedTranscript = (session.accumulatedTranscript || '') + transcript + ' ';
          Logger.info('ai-voice', 'Deepgram transcript received', {
            callSid,
            transcript,
            accumulated: session.accumulatedTranscript
          });
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        Logger.error('ai-voice', 'Deepgram streaming error', error);
      });

      connection.on(LiveTranscriptionEvents.Close, async () => {
        Logger.info('ai-voice', 'Deepgram connection closed', { callSid });

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

      Logger.info('ai-voice', 'Connected to Deepgram streaming', { callSid });

    } catch (error) {
      Logger.error('ai-voice', 'Failed to start Deepgram transcription', error as Error);
      transcriptionActive = false;
      session.isTranscribing = false;
    }
  };

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          session.streamSid = data.start.streamSid;
          Logger.info('ai-voice', 'Stream started', {
            callSid,
            streamSid: data.start.streamSid
          });

          // Send initial greeting (keeping your original greeting)
          try {
            Logger.info('ai-voice', 'Sending initial greeting', { callSid });
            await speakResponse(callSid, `Hello! I'm ready to talk. How can I help you today?`);
            Logger.info('ai-voice', 'Initial greeting sent successfully', { callSid });
          } catch (error) {
            Logger.error('ai-voice', `Failed to send initial greeting for call ${callSid}`, error as Error);
          }

          // Start AWS Transcribe
          startTranscription().catch(err => {
            Logger.error('ai-voice', 'Failed to start transcription', err as Error);
          });

          // Send keep-alive marks to Twilio to prevent timeout
          const twilioKeepAliveInterval = setInterval(() => {
            if (session.twilioWs && session.streamSid) {
              try {
                session.twilioWs.send(JSON.stringify({
                  event: 'mark',
                  streamSid: session.streamSid,
                  mark: {
                    name: 'keepalive'
                  }
                }));
              } catch (e) {
                clearInterval(twilioKeepAliveInterval);
              }
            } else {
              clearInterval(twilioKeepAliveInterval);
            }
          }, 10000); // Every 10 seconds

          // Store Twilio keep-alive interval for cleanup
          (session as any).keepAliveInterval = twilioKeepAliveInterval;

          break;

        case 'media':
          // Convert mulaw audio from Twilio to PCM for Deepgram
          if (data.media?.payload && session.deepgramConnection && (session as any).deepgramReady) {
            const mulawData = Buffer.from(data.media.payload, 'base64');

            // Decode mulaw to 16-bit PCM at 8kHz (returns Int16Array)
            const pcm8k = mulaw.decode(new Uint8Array(mulawData));

            // Upsample from 8kHz to 16kHz
            const pcm16k = upsample8kTo16k(pcm8k);

            // Convert Int16Array to Buffer
            const pcmBuffer = Buffer.from(pcm16k.buffer);

            // Send directly to Deepgram (no buffering needed, Deepgram handles streaming chunks)
            session.deepgramConnection.send(pcmBuffer);

            // Log first few sends to verify
            if (!(session as any).mediaPacketCount) (session as any).mediaPacketCount = 0;
            (session as any).mediaPacketCount++;
            if ((session as any).mediaPacketCount <= 3) {
              Logger.info('ai-voice', 'Audio sent to Deepgram', {
                callSid,
                packetNum: (session as any).mediaPacketCount,
                original8kSize: pcm8k.length * 2,
                upsampled16kSize: pcmBuffer.length,
                durationMs: (pcm8k.length / 8000 * 1000).toFixed(1)
              });
            }
          }
          break;

        case 'stop':
          Logger.info('ai-voice', 'Stream stopped', { callSid });
          session.isTranscribing = false;
          if (session.deepgramConnection) {
            session.deepgramConnection.finish();
          }
          endSession(callSid);
          break;
      }
    } catch (error) {
      Logger.error('ai-voice', `Media stream error for call ${callSid}`, error as Error);
    }
  });

  ws.on('close', async () => {
    Logger.info('ai-voice', 'Media stream closed', { callSid });
    session.isTranscribing = false;
    if (session.deepgramConnection) {
      session.deepgramConnection.finish();
    }
    endSession(callSid);
  });

  ws.on('error', (error) => {
    Logger.error('ai-voice', `Media stream WebSocket error for call ${callSid}`, error as Error);
  });
}
