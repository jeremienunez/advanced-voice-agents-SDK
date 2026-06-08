import { resamplePcm16 } from "../../agent/utils/audio.js";
import type {
  BrowserVoiceSampleRateResolver,
  BrowserVoiceSessionRequest,
} from "./types.js";

export function resolveSampleRate(
  resolver: BrowserVoiceSampleRateResolver | undefined,
  request: BrowserVoiceSessionRequest,
  fallback: number,
): number {
  if (typeof resolver === "function") return resolver(request);
  return resolver ?? fallback;
}

export function adaptPcm16SampleRate(
  payload: Buffer,
  fromSampleRate: number,
  toSampleRate: number,
): Buffer {
  if (fromSampleRate === toSampleRate) return payload;
  return resamplePcm16(payload, fromSampleRate, toSampleRate);
}
