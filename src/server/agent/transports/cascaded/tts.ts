/**
 * OpenAITTS — Text-to-Speech via OpenAI /v1/audio/speech
 *
 * Streams PCM16 24kHz audio from gpt-4o-mini-tts.
 * Supports `instructions` field for prosody/personality control.
 */

import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { AudioChunk } from "../../types/transport.types.js";
import type { ITTS } from "./types.js";

const TTS_URL = "https://api.openai.com/v1/audio/speech";

interface TtsConfig {
  model: string;
  voice: string;
  instructions?: string;
}

export class OpenAITTS implements ITTS {
  constructor(
    private readonly apiKey: string,
    private readonly config: TtsConfig,
  ) {}

  async *stream(
    text: string,
    signal?: AbortSignal,
  ): AsyncGenerator<AudioChunk> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      input: text,
      voice: this.config.voice,
      response_format: "pcm",
    };
    if (this.config.instructions) {
      body.instructions = this.config.instructions;
    }

    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new AgentError({
        code: ERROR_CODES.OPENAI_AUDIO_ERROR,
        message: `TTS failed: HTTP ${response.status} — ${errText}`,
        recoverable: response.status >= 500,
      });
    }

    const reader = response.body.getReader();
    let seq = 0;
    let leftover: Buffer | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      let chunk = Buffer.from(value);

      // Prepend leftover byte from previous chunk
      if (leftover) {
        chunk = Buffer.concat([leftover, chunk]);
        leftover = null;
      }

      // PCM16 requires even byte length — stash trailing odd byte
      if (chunk.length & 1) {
        leftover = chunk.subarray(chunk.length - 1);
        chunk = chunk.subarray(0, chunk.length - 1);
      }

      if (chunk.length === 0) continue;

      yield {
        payload: chunk,
        encoding: "pcm16" as const,
        sampleRate: 24000,
        channels: 1,
        timestamp: Date.now(),
        sequenceNumber: seq++,
      };
    }
  }
}
