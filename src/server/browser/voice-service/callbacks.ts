import type { ServerVoiceMessage } from "../../../sdk/types/browser-voice.js";
import type { BrowserMediaHandler } from "../../agent/handlers/index.js";
import type { VoiceSessionCallbacks } from "../../agent/types/session.types.js";
import type { AudioChunk } from "../../agent/types/transport.types.js";
import { adaptPcm16SampleRate } from "./audio.js";
import { mapSessionState } from "./protocol.js";
import type {
  ActiveBrowserSession,
  BrowserVoiceSocket,
} from "./types.js";

export interface BrowserSessionCallbackDeps {
  socket: BrowserVoiceSocket;
  mediaHandler: BrowserMediaHandler;
  browserSampleRate: number;
  getActiveSession: (socket: BrowserVoiceSocket) => ActiveBrowserSession | undefined;
  sendControl: (socket: BrowserVoiceSocket, message: ServerVoiceMessage) => void;
}

export function createBrowserSessionCallbacks(
  deps: BrowserSessionCallbackDeps,
): VoiceSessionCallbacks {
  return {
    onAudioOutput: (chunk: AudioChunk) => {
      const sampleRate = chunk.sampleRate || deps.browserSampleRate;
      deps.mediaHandler.handleLLMAudio({
        ...chunk,
        payload: adaptPcm16SampleRate(
          chunk.payload,
          sampleRate,
          deps.browserSampleRate,
        ),
        sampleRate: deps.browserSampleRate,
      });
    },
    onStateChange: (state) => {
      const mapped = mapSessionState(state);
      if (mapped) {
        deps.sendControl(deps.socket, { type: "state.change", state: mapped });
      }
    },
    onTranscript: (text, isFinal) => {
      const activeSession = deps.getActiveSession(deps.socket);
      if (activeSession) {
        activeSession.transcript.push({
          role: "user",
          text,
          isFinal,
          timestamp: Date.now(),
        });
        if (isFinal) activeSession.messageCount++;
      }
      deps.sendControl(deps.socket, {
        type: "transcript",
        text,
        isFinal,
        role: "user",
      });
    },
    onInterrupted: () => {
      deps.sendControl(deps.socket, {
        type: "state.change",
        state: "interrupted",
      });
    },
    onToolCall: (call) => {
      const activeSession = deps.getActiveSession(deps.socket);
      if (activeSession) {
        const index = activeSession.toolCalls.findIndex((item) => {
          return item.callId === call.callId;
        });
        const record = {
          callId: call.callId,
          toolName: call.toolName,
          arguments: call.arguments,
          startedAt: call.startedAt,
          status: call.status,
          completedAt:
            call.status === "completed" || call.status === "failed"
              ? Date.now()
              : undefined,
          result: call.result,
          error: call.error,
        };
        if (index >= 0) activeSession.toolCalls[index] = record;
        else activeSession.toolCalls.push(record);
      }

      if (call.status === "executing" || call.status === "pending") {
        deps.sendControl(deps.socket, {
          type: "tool.call",
          tool: {
            name: call.toolName,
            arguments: call.arguments,
          },
        });
        return;
      }

      deps.sendControl(deps.socket, {
        type: "tool.result",
        tool: {
          name: call.toolName,
          result: call.result ?? call.error ?? null,
        },
      });
      if (activeSession) activeSession.toolCallCount++;
    },
    onError: (error) => {
      deps.sendControl(deps.socket, {
        type: "session.error",
        error: {
          code: error.code,
          message: error.message,
        },
      });
    },
  };
}
