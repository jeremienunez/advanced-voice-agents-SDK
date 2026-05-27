import WebSocket, { type RawData } from "ws";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { GeminiServerMessage } from "../../types/gemini.types.js";
import type { AgentLogger } from "../../utils/index.js";
import {
  buildGeminiSetupPayload,
} from "./setup.js";
import type { GeminiRealtimeConfig } from "./types.js";

export interface GeminiRealtimeConnectionDeps {
  config: GeminiRealtimeConfig;
  model: string;
  logger: AgentLogger;
  handleMessage: (message: GeminiServerMessage) => void;
  onConnected: () => void;
  onClose: () => void;
}

export function connectGeminiRealtimeSocket(
  deps: GeminiRealtimeConnectionDeps,
): Promise<WebSocket> {
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${deps.config.apiKey}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: "Gemini connection timeout",
        }),
      );
      ws.close();
    }, deps.config.timeoutMs ?? 10000);

    ws.on("open", () => {
      const setup = buildGeminiSetupPayload(deps.config, deps.model);
      const payload = JSON.stringify(setup);
      deps.logger.info("Gemini setup payload", {
        model: deps.model,
        payloadLength: payload.length,
      });
      ws.send(payload);
    });

    ws.on("message", (data) => {
      const raw = data.toString();
      deps.logger.debug("Gemini raw message", {
        byteLength: raw.length,
      });
      const msg = parseGeminiMessage(data, deps.logger);
      if (!msg) return;

      if ("setupComplete" in msg) {
        clearTimeout(timeout);
        deps.onConnected();
        deps.logger.info("Gemini session established", { model: deps.model });
        resolve(ws);
        return;
      }

      deps.handleMessage(msg);
    });

    ws.on("close", (code, reason) => {
      const reasonText = reason?.toString();
      deps.logger.warn("Gemini WebSocket closed", { code, reason: reasonText });
      deps.onClose();
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      deps.logger.error("Gemini WebSocket error", { error: err.message });
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: err.message,
        }),
      );
    });
  });
}

function parseGeminiMessage(
  data: RawData,
  logger: AgentLogger,
): GeminiServerMessage | null {
  try {
    return JSON.parse(data.toString()) as GeminiServerMessage;
  } catch {
    logger.warn("Failed to parse Gemini message");
    return null;
  }
}
