import type {
  BrowserVoiceState,
  ClientVoiceMessage,
} from "../../../client/browser/types.js";

export const WS_OPEN = 1;
export const DEFAULT_BROWSER_SAMPLE_RATE = 24000;

export function parseClientMessage(data: unknown): ClientVoiceMessage | null {
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  try {
    const parsed = JSON.parse(text) as Partial<ClientVoiceMessage>;
    if (!parsed || typeof parsed.type !== "string") return null;
    if (
      parsed.type === "session.start" ||
      parsed.type === "session.end" ||
      parsed.type === "audio.pause" ||
      parsed.type === "audio.resume"
    ) {
      return parsed as ClientVoiceMessage;
    }
    return null;
  } catch {
    return null;
  }
}

export function toBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

export function randomSessionId(): string {
  return `voice_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function mapSessionState(state: string): BrowserVoiceState | null {
  switch (state) {
    case "connecting":
      return "connecting";
    case "listening":
    case "active":
      return "listening";
    case "speaking":
      return "speaking";
    case "processing":
    case "processing_tool":
      return "processing";
    case "interrupted":
      return "interrupted";
    case "error":
    case "fatal_error":
      return "error";
    case "ended":
      return "ended";
    default:
      return null;
  }
}
