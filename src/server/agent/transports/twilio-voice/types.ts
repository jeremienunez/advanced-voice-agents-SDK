import type { AudioChunk } from "../../types/transport.types.js";

export interface TwilioVoiceConfig {
  streamSid?: string;
  callSid?: string;
  encoding?: "mulaw" | "pcm16";
  sampleRate?: number;
}

export interface TwilioVoiceEventHandlers {
  onAudio?: (chunk: AudioChunk) => void;
  onStreamStart?: (
    streamSid: string,
    callSid: string,
    customParams?: Record<string, string>,
  ) => void;
  onStreamStop?: (reason: string) => void;
  onDtmf?: (digit: string) => void;
  onMark?: (name: string) => void;
}
