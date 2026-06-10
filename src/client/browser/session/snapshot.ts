import type { ServerVoiceMessage } from "../types.js";
import type {
  BrowserVoiceSessionSnapshot,
  ToolCallEntry,
  TranscriptEntry,
} from "./types.js";

export const INITIAL_SNAPSHOT: BrowserVoiceSessionSnapshot = {
  state: "idle",
  sessionId: null,
  transcript: [],
  toolCalls: [],
  durationMs: 0,
  isMuted: false,
  outputLevel: 0,
  error: null,
  learning: null,
};

export function cloneSnapshot(
  snapshot: BrowserVoiceSessionSnapshot,
): BrowserVoiceSessionSnapshot {
  return {
    ...snapshot,
    transcript: [...snapshot.transcript],
    toolCalls: [...snapshot.toolCalls],
  };
}

export function addTranscript(
  snapshot: BrowserVoiceSessionSnapshot,
  message: Extract<ServerVoiceMessage, { type: "transcript" }>,
): BrowserVoiceSessionSnapshot {
  const entry: TranscriptEntry = {
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: message.role,
    text: message.text,
    isFinal: message.isFinal,
    timestamp: Date.now(),
  };

  if (!message.isFinal) {
    const lastIndex = snapshot.transcript.findLastIndex((item) => {
      return item.role === message.role && !item.isFinal;
    });
    if (lastIndex >= 0) {
      const transcript = [...snapshot.transcript];
      transcript[lastIndex] = entry;
      return { ...snapshot, transcript };
    }
  }

  return {
    ...snapshot,
    transcript: [...snapshot.transcript, entry],
  };
}

export function upsertToolCall(
  snapshot: BrowserVoiceSessionSnapshot,
  message: Extract<ServerVoiceMessage, { type: "tool.call" }>,
): BrowserVoiceSessionSnapshot {
  const index = findToolCallIndex(snapshot, message.tool.callId, message.tool.name);
  const existing = index >= 0 ? snapshot.toolCalls[index] : null;
  const entry: ToolCallEntry = {
    id: existing?.id ?? message.tool.callId ?? `tool_${Date.now()}`,
    callId: message.tool.callId ?? existing?.callId,
    name: message.tool.name,
    arguments: message.tool.arguments,
    result: existing?.result ?? null,
    status: message.tool.status ?? existing?.status ?? "pending",
    timestamp: existing?.timestamp ?? Date.now(),
  };

  if (index < 0) {
    return { ...snapshot, toolCalls: [...snapshot.toolCalls, entry] };
  }

  const toolCalls = [...snapshot.toolCalls];
  toolCalls[index] = entry;
  return { ...snapshot, toolCalls };
}

export function completeToolCall(
  snapshot: BrowserVoiceSessionSnapshot,
  tool: Extract<ServerVoiceMessage, { type: "tool.result" }>["tool"],
): BrowserVoiceSessionSnapshot {
  const index = findToolCallIndex(snapshot, tool.callId, tool.name);
  if (index < 0) return snapshot;

  const toolCalls = [...snapshot.toolCalls];
  toolCalls[index] = {
    ...toolCalls[index],
    callId: tool.callId ?? toolCalls[index].callId,
    result: tool.result,
    status: tool.status ?? "completed",
  };
  return { ...snapshot, toolCalls };
}

function findToolCallIndex(
  snapshot: BrowserVoiceSessionSnapshot,
  callId: string | undefined,
  name: string,
): number {
  if (callId) {
    const byId = snapshot.toolCalls.findIndex((item) => item.callId === callId);
    if (byId >= 0) return byId;
  }
  return snapshot.toolCalls.findLastIndex((item) => {
    return item.name === name &&
      item.status !== "completed" &&
      item.status !== "failed";
  });
}
