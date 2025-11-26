declare module 'node-vad' {
  class VAD {
    constructor(mode: number);

    processAudio(samples: Buffer, sampleRate: number): Promise<number>;
    processAudioFloat(samples: Buffer, sampleRate: number): Promise<number>;

    static Mode: {
      NORMAL: number;
      LOW_BITRATE: number;
      AGGRESSIVE: number;
      VERY_AGGRESSIVE: number;
    };

    static Event: {
      ERROR: number;
      SILENCE: number;
      VOICE: number;
      NOISE: number;
    };

    static createStream(options: {
      mode: number;
      audioFrequency: number;
      debounceTime?: number;
    }): NodeJS.ReadWriteStream;
  }

  export = VAD;
}
