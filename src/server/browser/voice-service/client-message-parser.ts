import type { ClientVoiceMessage } from "../../../sdk/types/browser-voice.js";

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
