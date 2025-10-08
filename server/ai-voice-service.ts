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
  sessions.set(callSid, {
    companionId: companion.id,
    kindroidBotId: companion.kindroidBotId,
    kindroidApiKey,
    voiceId: companion.voiceId,
    elevenlabsApiKey,
    conversationHistory: [],
    callSid,
    isProcessing: false,
    audioBuffer: [],
  });

  Logger.info('ai-voice', 'Session initialized', { callSid, companionId: companion.id });
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
    const response = await fetch(`${process.env.KINDROID_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.kindroidApiKey}`
      },
      body: JSON.stringify({
        bot_id: session.kindroidBotId,
        message: userMessage,
        conversation_history: session.conversationHistory.slice(-10) // Last 10 messages for context
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
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
    Logger.error('ai-voice', 'Failed to get AI response', error as Error);
    throw error;
  }
}

/**
 * Convert text to speech using ElevenLabs and send to Twilio
 */
export async function speakResponse(callSid: string, text: string): Promise<void> {
  const session = sessions.get(callSid);

  if (!session || !session.twilioWs || !session.streamSid) {
    Logger.error('ai-voice', 'Cannot speak - session or connection not ready');
    return;
  }

  try {
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
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = await response.buffer();

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
    Logger.error('ai-voice', 'Failed to speak response', error as Error);
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
    Logger.error('ai-voice', 'Failed to process user speech', error as Error);

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
    Logger.error('ai-voice', 'Session not found for media stream', { callSid });
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

          // Start Deepgram live transcription
          deepgramLive = deepgram.listen.live({
            model: 'nova-2',
            language: 'en-US',
            smart_format: true,
            encoding: 'mulaw',
            sample_rate: 8000,
            channels: 1,
            interim_results: false,
          });

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
            Logger.error('ai-voice', 'Deepgram error', error);
          });

          session.deepgramConnection = deepgramLive;

          // Send initial greeting
          setTimeout(async () => {
            await speakResponse(callSid, `Hello! I'm ready to talk. How can I help you today?`);
          }, 500);

          break;

        case 'media':
          // Forward audio to Deepgram
          if (deepgramLive && data.media?.payload) {
            const audioData = Buffer.from(data.media.payload, 'base64');
            deepgramLive.send(audioData);
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
      Logger.error('ai-voice', 'Media stream error', error as Error);
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
    Logger.error('ai-voice', 'Media stream WebSocket error', error as Error);
  });
}
