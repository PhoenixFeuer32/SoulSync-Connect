import WebSocket from 'ws';
import fetch from 'node-fetch';
import { Logger } from './logger.js';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import textToSpeech from '@google-cloud/text-to-speech';

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
  const deepgram = createClient(deepgramApiKey);

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
          // Start Deepgram live transcription
          try {
            deepgramLive = deepgram.listen.live({
              model: 'nova-2',
              language: 'en-US',
              smart_format: true,
              encoding: 'mulaw',
              sample_rate: 8000,
              channels: 1,
              interim_results: true, 
              utterance_end_ms: 10000,
              endpointing: false,
              
            });
            Logger.info('ai-voice', 'Deepgram live transcription object created', { callSid });
          } catch (error) {
            Logger.error('ai-voice', 'Failed to create Deepgram live connection', error as Error);
            return;
          }

          // Handle transcription results
          deepgramLive.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            const isFinal = data.is_final;

            // Only process final transcripts (respects endpointing delay)
            if (transcript && transcript.trim().length > 0 && isFinal) {
              Logger.info('ai-voice', 'Final transcript received', {
                callSid,
                transcript
              });

              // Process the speech
              processUserSpeech(callSid, transcript);
            }
          });

          deepgramLive.on(LiveTranscriptionEvents.Error, (error: any) => {
            Logger.error('ai-voice', `Deepgram error for call ${callSid}`, error);
          });

          deepgramLive.on(LiveTranscriptionEvents.Open, () => {
            Logger.info('ai-voice', 'Deepgram connection opened', { callSid });
          });

          deepgramLive.on(LiveTranscriptionEvents.Close, () => {
            Logger.info('ai-voice', 'Deepgram connection closed', { callSid });
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
          // Forward audio to Deepgram
          if (deepgramLive && data.media?.payload) {
            const audioData = Buffer.from(data.media.payload, 'base64');
            deepgramLive.send(audioData);
            // (Logger.debug as any)('ai-voice', 'Forwarded audio to Deepgram', { callSid, payloadSize: audioData.length }); // Too verbose for production
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
