import type {
  ClientVoiceMessage,
} from "../../../sdk/types/browser-voice.js";
import type { IVoiceSession, SessionEndReason } from "../../agent/types/session.types.js";
import { createConsoleLoggerPort } from "../../observability/logger-port.js";
import { adaptPcm16SampleRate, resolveSampleRate } from "./audio.js";
import { createBrowserSessionCallbacks } from "./callbacks.js";
import {
  createBrowserControlEmitter,
  type BrowserControlEmitter,
} from "./control-emitter.js";
import {
  createBrowserMediaBridgeDefinition,
  createDefaultBrowserMediaBridgeFactory,
} from "./media-bridge.js";
import {
  DEFAULT_BROWSER_SAMPLE_RATE,
  parseClientMessage,
  toBuffer,
  WS_OPEN,
} from "./protocol.js";
import { createBrowserSessionRequest } from "./session-request.js";
import type {
  ActiveBrowserSession,
  BrowserVoiceServiceConfig,
  BrowserVoiceSessionEndedInput,
  BrowserVoiceSocket,
  BrowserVoiceUserContext,
} from "./types.js";

export class BrowserVoiceService {
  private readonly controlEmitter: BrowserControlEmitter;
  private readonly logger;
  private readonly activeSessions = new Map<
    BrowserVoiceSocket,
    ActiveBrowserSession
  >();

  constructor(private readonly config: BrowserVoiceServiceConfig) {
    this.logger = config.logger ?? createConsoleLoggerPort({
      component: "BrowserVoiceService",
    });
    this.controlEmitter = createBrowserControlEmitter({
      eventSink: config.eventSink,
      logger: this.logger,
    });
  }

  get activeSessionCount(): number {
    return this.activeSessions.size;
  }

  handleBrowserStream(
    socket: BrowserVoiceSocket,
    user: BrowserVoiceUserContext = {},
  ): void {
    socket.on("message", async (data, isBinary) => {
      try {
        if (isBinary) {
          this.handleBinaryAudio(socket, data);
          return;
        }

        const message = parseClientMessage(data);
        if (!message) return;

        switch (message.type) {
          case "session.start":
            await this.startSession(socket, user, message);
            break;
          case "session.end":
            await this.endSession(socket, "completed");
            break;
          case "audio.pause":
          case "audio.resume":
            break;
        }
      } catch (error) {
        this.logger.error("Browser voice message failed", { error });
        this.controlEmitter.emit(socket, {
          type: "session.error",
          error: {
            code: "processing_error",
            message: "Failed to process browser voice message",
          },
        });
      }
    });

    socket.on("close", () => {
      void this.endSession(socket, "user_hangup");
    });

    socket.on("error", (error) => {
      this.logger.error("Browser voice socket error", { error });
      void this.endSession(socket, "error");
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.activeSessions.keys()).map((socket) =>
        this.endSession(socket, "completed"),
      ),
    );
  }

  private handleBinaryAudio(socket: BrowserVoiceSocket, data: unknown): void {
    const activeSession = this.activeSessions.get(socket);
    if (!activeSession) return;

    const buffer = toBuffer(data);
    if (!buffer || buffer.length === 0) return;
    void activeSession.mediaBridge.ingestAudio(buffer);
  }

  private async startSession(
    socket: BrowserVoiceSocket,
    user: BrowserVoiceUserContext,
    message: Extract<ClientVoiceMessage, { type: "session.start" }>,
  ): Promise<void> {
    if (this.activeSessions.has(socket)) {
      this.controlEmitter.emit(socket, {
        type: "session.error",
        error: {
          code: "already_active",
          message: "A voice session is already active on this socket",
        },
      });
      return;
    }

    const request = createBrowserSessionRequest(this.config, user, message);
    const browserSampleRate =
      this.config.media?.browserSampleRate ?? DEFAULT_BROWSER_SAMPLE_RATE;
    const llmInputSampleRate = resolveSampleRate(
      this.config.media?.llmInputSampleRate,
      request,
      browserSampleRate,
    );

    let session: IVoiceSession | null = null;
    const mediaBridge = (this.config.media?.bridgeFactory ??
      createDefaultBrowserMediaBridgeFactory()).createMediaBridge({
        definition:
          this.config.media?.bridgeDefinition ??
          createBrowserMediaBridgeDefinition(browserSampleRate),
        browserSampleRate,
        llmInputSampleRate,
        options: {
          config: {
            enableAgc: this.config.media?.enableAgc ?? true,
            enableRnnoise: this.config.media?.enableRnnoise ?? false,
            enableNoiseGate: this.config.media?.enableNoiseGate ?? true,
          },
          onAudioToBrowser: (buffer) => {
            if (socket.readyState === WS_OPEN) socket.send(buffer);
          },
        },
        metadata: { sessionId: request.sessionId, provider: request.provider },
      });
    mediaBridge.onAudioToLlm((chunk) => {
      session?.handleAudio(
        adaptPcm16SampleRate(
          chunk.payload,
          chunk.sampleRate || browserSampleRate,
          llmInputSampleRate,
        ),
      );
    });

    const callbacks = createBrowserSessionCallbacks({
      socket,
      mediaBridge,
      browserSampleRate,
      getActiveSession: (activeSocket) => this.activeSessions.get(activeSocket),
      emitControl: (activeSocket, control) =>
        this.controlEmitter.emit(activeSocket, control),
    });

    try {
      session = await this.config.createSession(request, callbacks);
      await mediaBridge.init?.();

      this.activeSessions.set(socket, {
        sessionId: session.sessionId,
        request,
        session,
        mediaBridge,
        startedAt: Date.now(),
        messageCount: 0,
        toolCallCount: 0,
        transcript: [],
        toolCalls: [],
      });

      await session.start();
      await mediaBridge.start();

      this.controlEmitter.emit(socket, {
        type: "session.started",
        sessionId: session.sessionId,
      });
    } catch (error) {
      await mediaBridge.stop();
      this.activeSessions.delete(socket);
      this.logger.error("Failed to start browser voice session", { error });
      this.controlEmitter.emit(socket, {
        type: "session.error",
        error: {
          code: "session_start_failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to start voice session",
        },
      });
    }
  }

  private async endSession(
    socket: BrowserVoiceSocket,
    reason: SessionEndReason,
  ): Promise<void> {
    const activeSession = this.activeSessions.get(socket);
    if (!activeSession) return;
    let endedInput: BrowserVoiceSessionEndedInput | null = null;

    try {
      await activeSession.mediaBridge.stop();
      await activeSession.session.end(reason);
      const endedAt = Date.now();
      const summary = {
        sessionId: activeSession.sessionId,
        tenantId: activeSession.request.user.tenantId,
        userId: activeSession.request.user.userId,
        channel: "voice" as const,
        startedAt: activeSession.startedAt,
        endedAt,
        durationMs: endedAt - activeSession.startedAt,
        messageCount: activeSession.messageCount,
        toolCallCount: activeSession.toolCallCount,
        endReason: reason,
      };
      endedInput = {
        request: activeSession.request,
        summary,
        transcript: [...activeSession.transcript],
        toolCalls: activeSession.toolCalls.map((call) => ({ ...call })),
      };
      this.controlEmitter.emit(socket, {
        type: "session.ended",
        summary: {
          sessionId: activeSession.sessionId,
          durationMs: summary.durationMs,
          messageCount: activeSession.messageCount,
          toolCallCount: activeSession.toolCallCount,
        },
      });
    } catch (error) {
      this.logger.error("Failed to end browser voice session", { error });
    } finally {
      this.activeSessions.delete(socket);
    }

    if (endedInput && this.config.onSessionEnded) {
      void (async () => {
        await this.config.onSessionEnded?.(endedInput, (status) => {
          this.controlEmitter.emit(socket, {
            type: "learning.status",
            learning: status,
          });
        });
      })().catch((error) => {
        this.logger.error("Post-session learning hook failed", { error });
      });
    }
  }

}

export function createBrowserVoiceService(
  config: BrowserVoiceServiceConfig,
): BrowserVoiceService {
  return new BrowserVoiceService(config);
}
