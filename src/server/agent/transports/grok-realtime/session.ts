import { GROK_NATIVE_MULAW_FORMAT } from "../../types/grok.types.js";
import type {
  GrokRealtimeConfig,
  GrokSessionUpdatePayload,
} from "./types.js";

export function buildGrokSessionUpdatePayload(
  config: GrokRealtimeConfig,
): GrokSessionUpdatePayload {
  const audioFormat = config.audioFormat ?? GROK_NATIVE_MULAW_FORMAT;
  const session: GrokSessionUpdatePayload = {
    voice: config.voice ?? "Ara",
    turn_detection: { type: "server_vad" },
    audio: {
      input: { format: audioFormat },
      output: { format: audioFormat },
    },
  };

  if (config.instructions) {
    session.instructions = config.instructions;
  }
  if (config.tools?.length) {
    session.tools = config.tools;
  }

  return session;
}

export function buildGrokFunctionResultEvent(
  callId: string,
  result: unknown,
): Record<string, unknown> {
  return {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: typeof result === "string" ? result : JSON.stringify(result),
    },
  };
}

export function buildGrokSystemMessageEvent(
  content: string,
): Record<string, unknown> {
  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: `[System] ${content}` }],
    },
  };
}
