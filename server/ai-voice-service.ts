import WebSocket from 'ws';
import fetch from 'node-fetch';
import { Logger } from './logger.js';

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
}

const sessions = new Map<string, ConversationSession>();

/**
 * Initialize a conversation session for a call
 */
export function initializeSession(callSid: string, companion: any, elevenlabsApiKey: string, kindroidApiKey: string) {
  sessions.set(callSid, {
    companionId: companion.id,
    kindroidBotId: companion.kindroidBotId,
    kindroidApiKey,
    voiceId: companion.voiceId,
    elevenlabsApiKey,
    conversationHistory: [],
    callSid,
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
      throw new Error(`Kindroid API error: ${response.statusText}`);
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
 * Convert text to speech using ElevenLabs
 */
export async function textToSpeech(callSid: string, text: string): Promise<Buffer> {
  const session = sessions.get(callSid);

  if (!session) {
    throw new Error('Session not found');
  }

  try {
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
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = await response.buffer();

    Logger.info('ai-voice', 'Text-to-speech generated', {
      callSid,
      textLength: text.length,
      audioSize: audioBuffer.length
    });

    return audioBuffer;
  } catch (error) {
    Logger.error('ai-voice', 'Text-to-speech failed', error as Error);
    throw error;
  }
}

/**
 * Clean up session when call ends
 */
export function endSession(callSid: string) {
  const session = sessions.get(callSid);

  if (session) {
    Logger.info('ai-voice', 'Session ended', {
      callSid,
      messageCount: session.conversationHistory.length
    });
    sessions.delete(callSid);
  }
}

/**
 * Handle incoming audio stream from Twilio Media Streams
 */
export function handleMediaStream(ws: WebSocket, callSid: string) {
  Logger.info('ai-voice', 'Media stream connected', { callSid });

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);

      // Handle different Twilio Media Stream events
      switch (data.event) {
        case 'start':
          Logger.info('ai-voice', 'Stream started', { callSid, streamSid: data.start.streamSid });
          break;

        case 'media':
          // This contains the incoming audio from the caller
          // In a full implementation, you would:
          // 1. Buffer the audio chunks
          // 2. Use speech-to-text (e.g., Google Speech-to-Text or Deepgram)
          // 3. Send transcript to getAIResponse()
          // 4. Convert AI response to speech with textToSpeech()
          // 5. Send audio back through the stream

          // For now, log that we're receiving audio
          Logger.debug('ai-voice', 'Received audio chunk', {
            callSid,
            payloadSize: data.media.payload.length
          });
          break;

        case 'stop':
          Logger.info('ai-voice', 'Stream stopped', { callSid });
          endSession(callSid);
          break;
      }
    } catch (error) {
      Logger.error('ai-voice', 'Media stream error', error as Error);
    }
  });

  ws.on('close', () => {
    Logger.info('ai-voice', 'Media stream closed', { callSid });
    endSession(callSid);
  });

  ws.on('error', (error) => {
    Logger.error('ai-voice', 'Media stream WebSocket error', error as Error);
  });
}
