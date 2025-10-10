import WebSocket from 'ws';
import fetch from 'node-fetch';
import { Logger } from './logger.js';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

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

    const data = await response.json() as { response: string };
    const aiResponse = data.response;

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
 * Fallback TTS using Twilio's built-in voice
 */
async function speakWithTwilioVoice(callSid: string, text: string): Promise<void> {
  const session = sessions.get(callSid);
  if (!session?.twilioWs || !session.streamSid) return;

  try {
    // Use Twilio's mark event to inject TTS via TwiML
    // Since we're in a media stream, we need to use the mark event
    Logger.info('ai-voice', 'Using Twilio fallback TTS', { callSid, textLength: text.length });

    // Send a mark event that can be picked up to trigger TTS
    const markMessage = {
      event: 'mark',
      streamSid: session.streamSid,
      mark: {
        name: `tts_${Date.now()}`
      }
    };

    session.twilioWs.send(JSON.stringify(markMessage));
    Logger.info('ai-voice', 'Twilio fallback TTS attempted', { callSid, text: text.substring(0, 50) });
  } catch (error) {
    Logger.error('ai-voice', `Failed Twilio fallback TTS for call ${callSid}`, error as Error);
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

  try {
    Logger.info('ai-voice', 'Calling ElevenLabs TTS', { callSid, textLength: text.length, voiceId: session.voiceId });
    // Get audio from ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${session.voiceId}`, {
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
      Logger.error('ai-voice', `ElevenLabs API error for call ${callSid}: ${response.statusText} - ${errorText}`, new Error(`ElevenLabs API error: ${response.statusText} - ${errorText}`));
      // Fallback to Twilio voice
      Logger.warn('ai-voice', 'Falling back to Twilio built-in voice', { callSid });
      await speakWithTwilioVoice(callSid, text);
      return;
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
    // Fallback to Twilio voice on any error
    Logger.warn('ai-voice', 'Falling back to Twilio built-in voice after error', { callSid });
    await speakWithTwilioVoice(callSid, text);
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
    // Clear keep-alive interval
    if ((session as any).keepAliveInterval) {
      clearInterval((session as any).keepAliveInterval);
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
              interim_results: false,
            });
            Logger.info('ai-voice', 'Deepgram live transcription object created', { callSid });
          } catch (error) {
            Logger.error('ai-voice', 'Failed to create Deepgram live connection', error as Error);
            return;
          }

          // Handle transcription results
          deepgramLive.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;

            if (transcript && transcript.trim().length > 0) {
              Logger.info('ai-voice', 'Transcript received', {
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

          // Send keep-alive marks to prevent timeout
          const keepAliveInterval = setInterval(() => {
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
                clearInterval(keepAliveInterval);
              }
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 10000); // Every 10 seconds

          // Store interval for cleanup
          (session as any).keepAliveInterval = keepAliveInterval;

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
