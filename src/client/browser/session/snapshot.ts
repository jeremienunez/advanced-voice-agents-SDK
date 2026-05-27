import type { ServerVoiceMessage } from "../types.js";
import type {
  BrowserVoiceSessionSnapshot,
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

export function completeToolCall(
  snapshot: BrowserVoiceSessionSnapshot,
  name: string,
  result: unknown,
): BrowserVoiceSessionSnapshot {
  const index = snapshot.toolCalls.findLastIndex((item) => {
    return item.name === name && item.status === "pending";
  });
  if (index < 0) return snapshot;

  const toolCalls = [...snapshot.toolCalls];
  toolCalls[index] = {
    ...toolCalls[index],
    result,
    status: "completed",
  };
  return { ...snapshot, toolCalls };
}
