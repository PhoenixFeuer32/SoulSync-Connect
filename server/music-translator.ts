/**
 * Music Translator - Gives Kindroid "Ears"
 *
 * Translates audio features (from Spotify or WAV analysis) into natural
 * language descriptions that Kindroid can understand.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as MeydaModule from 'meyda';
import * as mm from 'music-metadata';

// Get Meyda from default export (ESM module quirk)
const Meyda = (MeydaModule as any).default || MeydaModule;

// Audio feature interfaces
export interface SpotifyAudioFeatures {
  tempo: number;           // BPM (0-250+)
  key: number;             // Pitch class (0-11, C=0, C#=1, etc.)
  mode: number;            // Major=1, Minor=0
  valence: number;         // Musical positivity (0.0-1.0)
  energy: number;          // Intensity/activity (0.0-1.0)
  danceability: number;    // Dance suitability (0.0-1.0)
  acousticness: number;    // Acoustic confidence (0.0-1.0)
  instrumentalness: number;// Instrumental confidence (0.0-1.0)
  speechiness?: number;    // Spoken word presence (0.0-1.0)
  liveness?: number;       // Live performance presence (0.0-1.0)
  loudness?: number;       // Overall loudness in dB (-60 to 0)
}

export interface WavAnalysisFeatures {
  tempo: number;           // Estimated BPM
  energy: number;          // Mapped from RMS/loudness
  valence: number;         // Estimated from spectral features
  acousticness: number;    // From spectral analysis
  danceability: number;    // From rhythm analysis
  instrumentalness: number;// From vocal detection
  spectralCentroid?: number;
  spectralFlatness?: number;
  zcr?: number;            // Zero crossing rate
}

export interface MusicDescription {
  summary: string;         // One-line description
  mood: string;            // Mood descriptor
  style: string;           // Style descriptors
  tempo: string;           // Tempo description
  details: string;         // Full natural language description
}

// Key names for musical key detection
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get mood description from valence and energy
 */
function getMood(valence: number, energy: number): string {
  if (valence > 0.7 && energy > 0.7) return "uplifting and energetic";
  if (valence > 0.7 && energy > 0.4) return "cheerful and lively";
  if (valence > 0.7 && energy < 0.4) return "peaceful and content";
  if (valence > 0.5 && energy > 0.7) return "exciting and dynamic";
  if (valence > 0.5 && energy > 0.4) return "balanced and pleasant";
  if (valence > 0.5 && energy < 0.4) return "relaxed and easy-going";
  if (valence > 0.3 && energy > 0.7) return "intense and powerful";
  if (valence > 0.3 && energy > 0.4) return "thoughtful and complex";
  if (valence > 0.3 && energy < 0.4) return "contemplative and mellow";
  if (valence < 0.3 && energy > 0.7) return "dark and aggressive";
  if (valence < 0.3 && energy > 0.4) return "brooding and tense";
  return "melancholic and introspective";
}

/**
 * Get style descriptors from audio features
 */
function getStyle(features: SpotifyAudioFeatures | WavAnalysisFeatures): string[] {
  const descriptors: string[] = [];

  if (features.acousticness > 0.7) descriptors.push("acoustic");
  else if (features.acousticness < 0.2) descriptors.push("electronic");

  if (features.danceability > 0.7) descriptors.push("danceable");
  else if (features.danceability < 0.3) descriptors.push("freeform");

  if (features.instrumentalness > 0.7) descriptors.push("instrumental");
  else if (features.instrumentalness < 0.1) descriptors.push("vocal-driven");

  if (features.energy > 0.8) descriptors.push("high-energy");
  else if (features.energy < 0.3) descriptors.push("ambient");

  // Spotify-specific features
  if ('speechiness' in features && features.speechiness && features.speechiness > 0.66) {
    descriptors.push("spoken-word");
  }
  if ('liveness' in features && features.liveness && features.liveness > 0.8) {
    descriptors.push("live performance");
  }

  return descriptors.length > 0 ? descriptors : ["melodic"];
}

/**
 * Get tempo description from BPM
 */
function getTempoDescription(bpm: number): string {
  if (bpm < 70) return "very slow and deliberate";
  if (bpm < 90) return "slow and relaxed";
  if (bpm < 110) return "moderate";
  if (bpm < 130) return "upbeat";
  if (bpm < 150) return "fast and driving";
  return "very fast and intense";
}

/**
 * Get key description
 */
function getKeyDescription(key: number, mode: number): string {
  if (key < 0 || key > 11) return "";
  const keyName = KEY_NAMES[key];
  const modeName = mode === 1 ? "major" : "minor";
  return `${keyName} ${modeName}`;
}

/**
 * Translate audio features to natural language description
 */
export function translateToNaturalLanguage(
  features: SpotifyAudioFeatures | WavAnalysisFeatures,
  trackName: string,
  artist?: string
): MusicDescription {
  const mood = getMood(features.valence, features.energy);
  const styleDescriptors = getStyle(features);
  const style = styleDescriptors.join(", ");
  const tempo = getTempoDescription(features.tempo);

  // Build the key info if available (Spotify only)
  let keyInfo = "";
  if ('key' in features && 'mode' in features && features.key >= 0) {
    keyInfo = ` in ${getKeyDescription(features.key, features.mode)}`;
  }

  // Build summary
  const artistPart = artist ? ` by ${artist}` : "";
  const summary = `"${trackName}"${artistPart} - ${mood} ${style} track`;

  // Build detailed description for Kindroid
  const details = `Phoenix is sharing "${trackName}"${artistPart} with you. ` +
    `It's a ${mood} ${style} track${keyInfo} with a ${tempo} pace at ${Math.round(features.tempo)} BPM. ` +
    (features.danceability > 0.6 ? "It has a great beat for moving to. " : "") +
    (features.acousticness > 0.6 ? "It has a warm, organic acoustic sound. " : "") +
    (features.instrumentalness > 0.5 ? "It's mostly instrumental. " : "") +
    (features.energy > 0.7 ? "It's full of energy! " : "") +
    (features.valence > 0.7 ? "It has a really positive, happy vibe." :
     features.valence < 0.3 ? "It has a more somber, emotional tone." : "");

  return {
    summary,
    mood,
    style,
    tempo,
    details: details.trim()
  };
}

/**
 * Detect song mentions in user messages
 * Patterns:
 * - "song name" by artist
 * - artist - song name
 * - "Have you heard [song] by [artist]?"
 * - "I'm listening to [song]"
 * - "Check out [song] by [artist]"
 */
export function detectSongMention(message: string): { song: string; artist: string } | null {
  // Normalize the message
  const normalized = message.trim();

  // Pattern 1: "song name" by artist (with or without quotes)
  const byPattern = /["']?([^"']+)["']?\s+by\s+([A-Za-z0-9\s&.'-]+?)(?:\s*[.!?]|\s*$)/i;
  let match = normalized.match(byPattern);
  if (match) {
    return { song: match[1].trim(), artist: match[2].trim() };
  }

  // Pattern 2: artist - song name (common format)
  const dashPattern = /^([A-Za-z0-9\s&.'-]+?)\s*[-–—]\s*([A-Za-z0-9\s&.'-]+?)(?:\s*[.!?]|\s*$)/;
  match = normalized.match(dashPattern);
  if (match) {
    return { song: match[2].trim(), artist: match[1].trim() };
  }

  // Pattern 3: "Have you heard X by Y" or "Check out X by Y"
  const actionPattern = /(?:have you heard|check out|listen to|listening to|playing)\s+["']?([^"']+?)["']?\s+by\s+([A-Za-z0-9\s&.'-]+)/i;
  match = normalized.match(actionPattern);
  if (match) {
    return { song: match[1].trim(), artist: match[2].trim() };
  }

  // Pattern 4: Explicit SONG: X, ARTIST: Y format (existing pattern)
  const explicitPattern1 = /SONG:\s*([^,]+),?\s*ARTIST:\s*(.+)/i;
  match = normalized.match(explicitPattern1);
  if (match) {
    return { song: match[1].trim(), artist: match[2].trim() };
  }

  // Pattern 5: ARTIST: X, SONG: Y format
  const explicitPattern2 = /ARTIST:\s*([^,]+),?\s*SONG:\s*(.+)/i;
  match = normalized.match(explicitPattern2);
  if (match) {
    return { song: match[2].trim(), artist: match[1].trim() };
  }

  return null;
}

/**
 * Analyze WAV file and extract audio features
 */
export async function analyzeWavFile(filePath: string): Promise<WavAnalysisFeatures> {
  // Read file metadata first
  const metadata = await mm.parseFile(filePath);
  const sampleRate = metadata.format.sampleRate || 44100;
  const duration = metadata.format.duration || 0;

  // Read the raw audio data
  const fileBuffer = fs.readFileSync(filePath);

  // Convert buffer to audio samples (assuming 16-bit PCM WAV)
  // Skip WAV header (typically 44 bytes)
  const headerSize = 44;
  const samples: number[] = [];

  for (let i = headerSize; i < fileBuffer.length - 1; i += 2) {
    // Read 16-bit signed integer
    let sample = fileBuffer.readInt16LE(i);
    // Normalize to -1 to 1 range
    samples.push(sample / 32768);
  }

  if (samples.length === 0) {
    throw new Error('Could not extract audio samples from WAV file');
  }

  // Analyze using Meyda
  // We'll analyze multiple windows and average the results
  const bufferSize = 2048;
  const hopSize = 1024;
  const numWindows = Math.floor((samples.length - bufferSize) / hopSize);

  let totalRms = 0;
  let totalZcr = 0;
  let totalSpectralCentroid = 0;
  let totalSpectralFlatness = 0;
  let validWindows = 0;

  // Analyze windows throughout the audio
  for (let i = 0; i < Math.min(numWindows, 100); i++) {
    const windowIndex = Math.floor(i * numWindows / 100);
    const start = windowIndex * hopSize;
    const window = samples.slice(start, start + bufferSize);

    if (window.length < bufferSize) continue;

    try {
      const features = Meyda.extract(
        ['rms', 'zcr', 'spectralCentroid', 'spectralFlatness'],
        window
      );

      if (features) {
        if (features.rms) totalRms += features.rms;
        if (features.zcr) totalZcr += features.zcr;
        if (features.spectralCentroid) totalSpectralCentroid += features.spectralCentroid;
        if (features.spectralFlatness) totalSpectralFlatness += features.spectralFlatness;
        validWindows++;
      }
    } catch (e) {
      // Skip problematic windows
    }
  }

  if (validWindows === 0) {
    throw new Error('Could not analyze audio features');
  }

  // Calculate averages
  const avgRms = totalRms / validWindows;
  const avgZcr = totalZcr / validWindows;
  const avgSpectralCentroid = totalSpectralCentroid / validWindows;
  const avgSpectralFlatness = totalSpectralFlatness / validWindows;

  // Map raw features to Spotify-like features
  // These mappings are approximations based on audio characteristics

  // Energy: derived from RMS (loudness)
  // RMS typically ranges 0-0.5 for music, map to 0-1
  const energy = Math.min(1, avgRms * 4);

  // Acousticness: lower spectral flatness suggests more tonal (acoustic)
  // Spectral flatness 0 = tonal, 1 = noise-like
  const acousticness = 1 - Math.min(1, avgSpectralFlatness * 2);

  // Valence: approximated from spectral centroid (brighter = happier)
  // and energy (higher energy often correlates with positive valence)
  // This is a rough approximation
  const normalizedCentroid = Math.min(1, avgSpectralCentroid / (sampleRate / 4));
  const valence = (normalizedCentroid * 0.6 + energy * 0.4);

  // Danceability: from rhythm regularity (approximated by ZCR consistency)
  // Higher energy + moderate tempo often = more danceable
  const danceability = (energy * 0.5 + (1 - Math.abs(avgZcr - 0.1) * 5) * 0.5);

  // Instrumentalness: difficult to determine without ML
  // Use spectral flatness as proxy (instrumental often has cleaner spectrum)
  const instrumentalness = avgSpectralFlatness < 0.3 ? 0.6 : 0.3;

  // Tempo: use autocorrelation-based BPM estimation
  const tempo = estimateTempo(samples, sampleRate);

  return {
    tempo,
    energy: Math.max(0, Math.min(1, energy)),
    valence: Math.max(0, Math.min(1, valence)),
    acousticness: Math.max(0, Math.min(1, acousticness)),
    danceability: Math.max(0, Math.min(1, danceability)),
    instrumentalness: Math.max(0, Math.min(1, instrumentalness)),
    spectralCentroid: avgSpectralCentroid,
    spectralFlatness: avgSpectralFlatness,
    zcr: avgZcr
  };
}

/**
 * Simple tempo estimation using onset detection
 */
function estimateTempo(samples: number[], sampleRate: number): number {
  // Simple energy-based onset detection
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  const energies: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += samples[start + j] * samples[start + j];
    }
    energies.push(energy / frameSize);
  }

  // Calculate onset flux (energy differences)
  const flux: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    flux.push(Math.max(0, diff));
  }

  // Simple autocorrelation for periodicity detection
  const minLag = Math.floor(sampleRate * hopSize / frameSize / 200); // 200 BPM max
  const maxLag = Math.floor(sampleRate * hopSize / frameSize / 60);  // 60 BPM min

  let bestLag = minLag;
  let bestCorr = 0;

  for (let lag = minLag; lag <= Math.min(maxLag, flux.length / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < flux.length - lag; i++) {
      corr += flux[i] * flux[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Convert lag to BPM
  const secondsPerBeat = (bestLag * hopSize) / sampleRate;
  const bpm = 60 / secondsPerBeat;

  // Clamp to reasonable range
  if (bpm < 60) return bpm * 2;
  if (bpm > 200) return bpm / 2;
  return Math.round(bpm);
}

/**
 * Format a music description for sending to Kindroid
 */
export function formatForKindroid(
  description: MusicDescription,
  includeContext: boolean = true
): string {
  if (includeContext) {
    return description.details;
  }
  return description.summary;
}
