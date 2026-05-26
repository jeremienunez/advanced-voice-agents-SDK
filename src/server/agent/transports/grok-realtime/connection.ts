import WebSocket, { type RawData } from "ws";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { AgentLogger } from "../../utils/index.js";
import { buildGrokSessionUpdatePayload } from "./session.js";
import type { GrokRealtimeConfig } from "./types.js";

export interface GrokRealtimeConnectionDeps {
  config: GrokRealtimeConfig;
  logger: AgentLogger;
  handleMessage: (data: RawData) => void;
  onConnected: () => void;
  onClose: () => void;
}

export function connectGrokRealtimeSocket(
  deps: GrokRealtimeConnectionDeps,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://api.x.ai/v1/realtime", {
      headers: {
        Authorization: `Bearer ${deps.config.apiKey}`,
      },
    });

    const timeout = setTimeout(() => {
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: "Grok connection timeout",
        }),
      );
      ws.close();
    }, deps.config.timeoutMs ?? 10000);

    ws.on("open", () => {
      const session = buildGrokSessionUpdatePayload(deps.config);
      deps.logger.info("Grok session.update payload", {
        voice: session.voice,
        hasInstructions: !!session.instructions,
        instructionsLength: session.instructions?.length ?? 0,
        instructionsPreview: session.instructions?.substring(0, 200) ?? "NONE",
        toolCount: session.tools?.length ?? 0,
        toolNames: session.tools?.map((tool) => tool.name) ?? [],
      });
      ws.send(JSON.stringify({ type: "session.update", session }));
      deps.onConnected();
      clearTimeout(timeout);
      deps.logger.info("Grok session established");
      resolve(ws);
    });

    ws.on("message", deps.handleMessage);
    ws.on("close", deps.onClose);
    ws.on("error", (err) => {
      clearTimeout(timeout);
      deps.logger.error("WebSocket error", { error: err.message });
      reject(
        new AgentError({
          code: ERROR_CODES.TRANSPORT_CONNECTION_FAILED,
          message: err.message,
        }),
      );
    });
  });
}
