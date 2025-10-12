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
  deepgramConnection?: any;
  twilioWs?: WebSocket;
  streamSid?: string;
  isProcessing: boolean;
  audioBuffer: string[];
}

const sessions = new Map<string, ConversationSession>();

/**
 * Initialize a conversation session for a call
 */
export function initializeSession(
  callSid: string,
  companion: any,
  elevenlabsApiKey: string,
  kindroidApiKey: string,
  deepgramApiKey: string
) {
  const newSession: ConversationSession = {
    companionId: companion.id,
    kindroidBotId: companion.kindroidBotId,
    kindroidApiKey,
    voiceId: companion.voiceId,
    elevenlabsApiKey,
    conversationHistory: [],
    callSid,
    isProcessing: false,
    audioBuffer: [],
  };
  sessions.set(callSid, newSession);

  Logger.info('ai-voice', 'Session initialized', { callSid, companionId: companion.id });
  (Logger.debug as any)('ai-voice', 'Session details', {
    voiceId: newSession.voiceId,
    hasElevenlabsKey: !!newSession.elevenlabsApiKey,
    hasKindroidKey: !!newSession.kindroidApiKey,
    hasDeepgramKey: !!deepgramApiKey,
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
    Logger.info('ai-voice', 'Calling ElevenLabs TTS', { callSid, textLength: text.length, voiceId: voiceIdToUse });
    // Get audio from ElevenLabs
    let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIdToUse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': session.elevenlabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        },
        output_format: 'ulaw_8000' // Twilio expects μ-law at 8kHz
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Check if it's an instant voice cloning permission error
      if (errorText.includes('ivc_not_permitted') || errorText.includes('instant')) {
        Logger.warn('ai-voice', `Primary voice not permitted, trying fallback voice ${fallbackVoiceId}`, { callSid });

        // Retry with fallback voice
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': session.elevenlabsApiKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            },
            output_format: 'ulaw_8000'
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
    (Logger.debug as any)('ai-voice', 'ElevenLabs audio buffer received', { callSid, audioSize: audioBuffer.length });

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

  try {
    Logger.info('ai-voice', 'Processing user speech', { callSid, transcript });

    // Get AI response from Kindroid
    const aiResponse = await getAIResponse(callSid, transcript);

    // Convert to speech and send back
    await speakResponse(callSid, aiResponse);

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

    // Clear Deepgram keep-alive interval
    if ((session as any).deepgramKeepAliveInterval) {
      clearInterval((session as any).deepgramKeepAliveInterval);
    }

    // Close Deepgram connection if exists
    if (session.deepgramConnection) {
      try {
        session.deepgramConnection.finish();
      } catch (e) {
        // Ignore
      }
    }

    Logger.info('ai-voice', 'Session ended', {
      callSid,
      messageCount: session.conversationHistory.length
    });
    sessions.delete(callSid);
  }
}

/**
 * Handle incoming audio stream from Twilio Media Streams with Deepgram STT
 */
export function handleMediaStream(ws: WebSocket, callSid: string, deepgramApiKey: string) {
  const session = sessions.get(callSid);

  if (!session) {
    Logger.error('ai-voice', `Session not found for media stream: ${callSid}`, new Error('Session not found'));
    return;
  }

  session.twilioWs = ws;
  Logger.info('ai-voice', 'Media stream connected', { callSid });

  // Initialize Deepgram client
  if (!deepgramApiKey || deepgramApiKey.length < 10) {
    Logger.error('ai-voice', 'Invalid Deepgram API key', new Error('Missing or invalid API key'));
    return;
  }
  Logger.info('ai-voice', 'Initializing Deepgram client', {
    callSid,
    keyPrefix: deepgramApiKey.substring(0, 8) + '...'
  });

  // Create Deepgram client with explicit port 443
  const deepgram = createClient(deepgramApiKey, {
    global: {
      url: 'https://api.deepgram.com:443'
    }
  });

  let deepgramLive: any = null;

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

          Logger.info('ai-voice', 'Initializing Deepgram live transcription', { callSid });
          // Start Deepgram live transcription with Flux model
          try {
            const fluxOptions = {
                model: 'flux-general-en',
                encoding: 'linear16',
                sample_rate: 16000,
                eot_threshold: 0.8,
                eager_eot_threshold: 0.6,
                eot_timeout_ms: 10000,
            };
            Logger.info('ai-voice', 'Connecting to Deepgram with Flux options', { callSid, options: fluxOptions });

            // Explicitly use v2 endpoint for Flux (SDK defaults to v1)
            deepgramLive = deepgram.listen.live(fluxOptions, 'v2/listen');

            Logger.info('ai-voice', 'Deepgram live transcription object created with Flux on v2 endpoint', { callSid });
          } catch (error) {
            Logger.error('ai-voice', 'Failed to create Deepgram live connection', error as Error);
            return;
          }

          // Handle Flux state machine events
          deepgramLive.on('StartOfTurn', (data: any) => {
            Logger.info('ai-voice', 'Flux StartOfTurn event', {
              callSid,
              turnIndex: data.turn_index
            });
          });

          deepgramLive.on('Update', (data: any) => {
            Logger.info('ai-voice', 'Flux Update event', {
              callSid,
              transcript: data.transcript,
              turnIndex: data.turn_index
            });
          });

          deepgramLive.on('EndOfTurn', (data: any) => {
            const transcript = data.transcript;

            Logger.info('ai-voice', 'Flux EndOfTurn event', {
              callSid,
              transcript,
              turnIndex: data.turn_index
            });

            if (transcript && transcript.trim().length > 0) {
              processUserSpeech(callSid, transcript);
            }
          });

          // Log all events to debug what Deepgram is actually sending
          deepgramLive.on('Metadata', (data: any) => {
            Logger.info('ai-voice', 'Deepgram Metadata event', {
              callSid,
              data,
              dgError: data['dg-error'],
              dgRequestId: data['dg-request-id']
            });
          });

          deepgramLive.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            Logger.info('ai-voice', 'Deepgram Transcript event (should not fire for Flux)', { callSid, data });
          });

          deepgramLive.on(LiveTranscriptionEvents.Error, (error: any) => {
            const errorDetails = {
              message: error.message || String(error),
              type: error.type,
              description: error.description,
              variant: error.variant,
              code: error.code,
              status: error.status,
              dgRequestId: error['dg-request-id'] || error.dgRequestId,
              dgError: error['dg-error'] || error.dgError,
              rawError: JSON.stringify(error)
            };
            Logger.error('ai-voice', `Deepgram error for call ${callSid}`, new Error(JSON.stringify(errorDetails)));
          });

          deepgramLive.on(LiveTranscriptionEvents.Open, () => {
            Logger.info('ai-voice', 'Deepgram connection opened', { callSid });
          });

          deepgramLive.on(LiveTranscriptionEvents.UtteranceEnd, (data: any) => {
            Logger.info('ai-voice', 'Deepgram UtteranceEnd event', {
              callSid,
              data: JSON.stringify(data)
            });
          });

          deepgramLive.on(LiveTranscriptionEvents.Close, (event: any) => {
            Logger.info('ai-voice', 'Deepgram connection closed', {
              callSid,
              code: event?.code,
              reason: event?.reason,
              fullEvent: JSON.stringify(event),
              dgError: event?.['dg-error'],
              dgRequestId: event?.['dg-request-id']
            });
          });

          session.deepgramConnection = deepgramLive;

          // Send initial greeting
          setTimeout(async () => {
            try {
              Logger.info('ai-voice', 'Sending initial greeting', { callSid });
              await speakResponse(callSid, `Hello! I'm ready to talk. How can I help you today?`);
              Logger.info('ai-voice', 'Initial greeting sent successfully', { callSid });
            } catch (error) {
              Logger.error('ai-voice', `Failed to send initial greeting for call ${callSid}`, error as Error);
            }
          }, 1000);

          // Send keep-alive to Deepgram to prevent connection timeout
          const deepgramKeepAliveInterval = setInterval(() => {
            if (deepgramLive) {
              try {
                deepgramLive.keepAlive();
                (Logger.debug as any)('ai-voice', 'Deepgram KeepAlive sent', { callSid });
              } catch (e) {
                clearInterval(deepgramKeepAliveInterval);
              }
            } else {
              clearInterval(deepgramKeepAliveInterval);
            }
          }, 5000); // Every 5 seconds to prevent 10-second timeout

          // Store Deepgram keep-alive interval for cleanup
          (session as any).deepgramKeepAliveInterval = deepgramKeepAliveInterval;

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
          // Convert mulaw (8kHz) to linear16 PCM (16kHz) and forward to Deepgram
          if (deepgramLive && data.media?.payload) {
            const mulawData = Buffer.from(data.media.payload, 'base64');

            // Decode mulaw to 16-bit PCM (returns Int16Array)
            const pcm8k = mulaw.decode(new Uint8Array(mulawData));

            // Upsample from 8kHz to 16kHz by simple interpolation (duplicate each sample)
            const pcm16k = new Int16Array(pcm8k.length * 2);
            for (let i = 0; i < pcm8k.length; i++) {
              pcm16k[i * 2] = pcm8k[i];
              pcm16k[i * 2 + 1] = pcm8k[i];  // Duplicate sample for simple upsampling
            }

            // Convert Int16Array to Buffer for sending
            const linear16Buffer = Buffer.from(pcm16k.buffer);
            deepgramLive.send(linear16Buffer);

            // Log first few media packets to verify audio is flowing
            if (!(session as any).mediaPacketCount) (session as any).mediaPacketCount = 0;
            (session as any).mediaPacketCount++;
            if ((session as any).mediaPacketCount <= 3) {
              Logger.info('ai-voice', 'Audio forwarded to Deepgram', {
                callSid,
                packetNum: (session as any).mediaPacketCount,
                mulawSize: mulawData.length,
                pcm8kSamples: pcm8k.length,
                pcm16kSamples: pcm16k.length,
                linear16Size: linear16Buffer.length
              });
            }
          }
          break;

        case 'stop':
          Logger.info('ai-voice', 'Stream stopped', { callSid });
          if (deepgramLive) {
            deepgramLive.finish();
          }
          endSession(callSid);
          break;
      }
    } catch (error) {
      Logger.error('ai-voice', `Media stream error for call ${callSid}`, error as Error);
    }
  });

  ws.on('close', () => {
    Logger.info('ai-voice', 'Media stream closed', { callSid });
    if (deepgramLive) {
      deepgramLive.finish();
    }
    endSession(callSid);
  });

  ws.on('error', (error) => {
    Logger.error('ai-voice', `Media stream WebSocket error for call ${callSid}`, error as Error);
  });
}
