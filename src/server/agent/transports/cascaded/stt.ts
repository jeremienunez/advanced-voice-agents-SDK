/**
 * WhisperSTT — OpenAI Whisper Speech-to-Text implementation
 *
 * Converts PCM16 audio buffer to text transcript via /v1/audio/transcriptions.
 * Prepends minimal WAV header for Whisper API compatibility.
 */

import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { ISTT } from "./types.js";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export class WhisperSTT implements ISTT {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "whisper-1",
    private readonly language: string = "fr",
  ) {}

  async transcribe(audio: Buffer, signal?: AbortSignal): Promise<string> {
    const wavBuffer = buildWavBuffer(audio);
    // Copy Buffer to ArrayBuffer (avoids SharedArrayBuffer → BlobPart incompatibility)
    const ab = new ArrayBuffer(wavBuffer.byteLength);
    new Uint8Array(ab).set(
      new Uint8Array(
        wavBuffer.buffer,
        wavBuffer.byteOffset,
        wavBuffer.byteLength,
      ),
    );
    const blob = new Blob([ab], { type: "audio/wav" });

    const formData = new FormData();
    formData.append("file", blob, "audio.wav");
    formData.append("model", this.model);
    formData.append("language", this.language);
    formData.append("response_format", "text");

    const response = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new AgentError({
        code: ERROR_CODES.OPENAI_RESPONSE_ERROR,
        message: `Whisper STT failed: HTTP ${response.status} — ${errText}`,
        recoverable: response.status >= 500,
      });
    }

    return (await response.text()).trim();
  }
}

// =============================================================================
// WAV Header Builder (44 bytes, no external dependency)
// =============================================================================

function buildWavBuffer(pcm16: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm16.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm16]);
}
