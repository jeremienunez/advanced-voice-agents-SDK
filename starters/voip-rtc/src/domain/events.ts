import type { ServerVoiceMessage } from "@voiceagentsdk/core/client/browser";

export interface EventLogEntry {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
}

export function eventFromMessage(message: ServerVoiceMessage): EventLogEntry {
  return {
    id: crypto.randomUUID(),
    label: message.type,
    detail: summarizeMessage(message),
    timestamp: new Date().toLocaleTimeString(),
  };
}

function summarizeMessage(message: ServerVoiceMessage): string {
  switch (message.type) {
    case "session.started":
      return message.sessionId;
    case "session.ended":
      return `${message.summary.durationMs} ms`;
    case "learning.status":
      return `${message.learning.status}: ${message.learning.message ?? message.learning.runId}`;
    case "session.error":
      return message.error.message;
    case "state.change":
      return message.state;
    case "transcript":
      return message.text;
    case "tool.call":
      return message.tool.name;
    case "tool.result":
      return message.tool.name;
    default:
      return JSON.stringify(message);
  }
}
