import WebSocket, { type RawData } from "ws";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { OpenAIServerEvent } from "../../types/openai.types.js";
import type { OpenAIRealtimeConfig } from "./types.js";

export interface OpenAIRealtimeConnectionDeps {
  config: OpenAIRealtimeConfig;
  handleMessage: (data: RawData) => OpenAIServerEvent | null;
  onSessionCreated: () => void;
  onClose: () => void;
}

export function connectOpenAIRealtimeSocket(
  deps: OpenAIRealtimeConnectionDeps,
): Promise<WebSocket> {
  const model = deps.config.model ?? "gpt-realtime-1.5";
  const url = `wss://api.openai.com/v1/realtime?model=${model}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${deps.config.apiKey}`,
  };
  if (deps.config.safetyIdentifier) {
    headers["OpenAI-Safety-Identifier"] = deps.config.safetyIdentifier;
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    const timeout = setTimeout(() => {
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: "Connection timeout",
        }),
      );
      ws.close();
    }, deps.config.timeoutMs ?? 10000);

    ws.on("open", () => {
      /* Wait for session.created */
    });
    ws.on("message", (data) => {
      const event = deps.handleMessage(data);
      if (event?.type === "session.created") {
        clearTimeout(timeout);
        deps.onSessionCreated();
        resolve(ws);
      }
    });
    ws.on("close", deps.onClose);
    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: err.message,
        }),
      );
    });
  });
}
