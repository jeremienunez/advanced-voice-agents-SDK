import type { BrowserVoiceState } from "../../../sdk/types/browser-voice.js";

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
