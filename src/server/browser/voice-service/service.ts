import type {
  ClientVoiceMessage,
  ServerVoiceMessage,
} from "../../../client/browser/types.js";
import {
  createBrowserMediaHandler,
} from "../../agent/handlers/index.js";
import type { IVoiceSession, SessionEndReason } from "../../agent/types/session.types.js";
import { createAgentLogger } from "../../agent/utils/index.js";
import { adaptPcm16SampleRate, resolveSampleRate } from "./audio.js";
import { createBrowserSessionCallbacks } from "./callbacks.js";
import {
  DEFAULT_BROWSER_SAMPLE_RATE,
  parseClientMessage,
  randomSessionId,
  toBuffer,
  WS_OPEN,
} from "./protocol.js";
import type {
  ActiveBrowserSession,
  BrowserVoiceServiceConfig,
  BrowserVoiceSessionRequest,
  BrowserVoiceSocket,
  BrowserVoiceUserContext,
} from "./types.js";

export class BrowserVoiceService {
  private readonly logger = createAgentLogger("BrowserVoiceService");
  private readonly activeSessions = new Map<
    BrowserVoiceSocket,
    ActiveBrowserSession
  >();

  constructor(private readonly config: BrowserVoiceServiceConfig) {}

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
        this.sendControl(socket, {
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
    activeSession.mediaHandler.handleBrowserAudio(buffer);
  }

  private async startSession(
    socket: BrowserVoiceSocket,
    user: BrowserVoiceUserContext,
    message: Extract<ClientVoiceMessage, { type: "session.start" }>,
  ): Promise<void> {
    if (this.activeSessions.has(socket)) {
      this.sendControl(socket, {
        type: "session.error",
        error: {
          code: "already_active",
          message: "A voice session is already active on this socket",
        },
      });
      return;
    }

    const request = this.createSessionRequest(user, message);
    const browserSampleRate =
      this.config.media?.browserSampleRate ?? DEFAULT_BROWSER_SAMPLE_RATE;
    const llmInputSampleRate = resolveSampleRate(
      this.config.media?.llmInputSampleRate,
      request,
      browserSampleRate,
    );

    let session: IVoiceSession | null = null;
    const mediaHandler = createBrowserMediaHandler(
      {
        enableAgc: this.config.media?.enableAgc ?? true,
        enableRnnoise: this.config.media?.enableRnnoise ?? false,
        enableNoiseGate: this.config.media?.enableNoiseGate ?? true,
      },
      {
        onAudioToBrowser: (buffer) => {
          if (socket.readyState === WS_OPEN) socket.send(buffer);
        },
        onAudioToLLM: (chunk) => {
          session?.handleAudio(
            adaptPcm16SampleRate(
              chunk.payload,
              browserSampleRate,
              llmInputSampleRate,
            ),
          );
        },
      },
    );

    const callbacks = createBrowserSessionCallbacks({
      socket,
      mediaHandler,
      browserSampleRate,
      getActiveSession: (activeSocket) => this.activeSessions.get(activeSocket),
      sendControl: (activeSocket, control) =>
        this.sendControl(activeSocket, control),
    });

    try {
      session = await this.config.createSession(request, callbacks);
      await mediaHandler.initRnnoise();

      this.activeSessions.set(socket, {
        sessionId: session.sessionId,
        session,
        mediaHandler,
        startedAt: Date.now(),
        messageCount: 0,
        toolCallCount: 0,
      });

      await session.start();
      mediaHandler.start();

      this.sendControl(socket, {
        type: "session.started",
        sessionId: session.sessionId,
      });
    } catch (error) {
      mediaHandler.stop();
      this.activeSessions.delete(socket);
      this.logger.error("Failed to start browser voice session", { error });
      this.sendControl(socket, {
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

  private createSessionRequest(
    user: BrowserVoiceUserContext,
    message: Extract<ClientVoiceMessage, { type: "session.start" }>,
  ): BrowserVoiceSessionRequest {
    return {
      sessionId: this.config.createSessionId?.() ?? randomSessionId(),
      provider: message.provider,
      agent: message.agent,
      model: message.model,
      voice: message.voice,
      providerOptions: message.providerOptions,
      conversationId: message.conversationId,
      user,
    };
  }

  private async endSession(
    socket: BrowserVoiceSocket,
    reason: SessionEndReason,
  ): Promise<void> {
    const activeSession = this.activeSessions.get(socket);
    if (!activeSession) return;

    try {
      activeSession.mediaHandler.stop();
      await activeSession.session.end(reason);
      this.sendControl(socket, {
        type: "session.ended",
        summary: {
          sessionId: activeSession.sessionId,
          durationMs: Date.now() - activeSession.startedAt,
          messageCount: activeSession.messageCount,
          toolCallCount: activeSession.toolCallCount,
        },
      });
    } catch (error) {
      this.logger.error("Failed to end browser voice session", { error });
    } finally {
      this.activeSessions.delete(socket);
    }
  }

  private sendControl(
    socket: BrowserVoiceSocket,
    message: ServerVoiceMessage,
  ): void {
    if (socket.readyState !== WS_OPEN) return;
    socket.send(JSON.stringify(message));
  }
}

export function createBrowserVoiceService(
  config: BrowserVoiceServiceConfig,
): BrowserVoiceService {
  return new BrowserVoiceService(config);
}
