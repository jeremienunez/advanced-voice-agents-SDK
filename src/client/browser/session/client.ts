import { revokeWorkletURLs } from "../audio-worklet.js";
import type {
  ClientVoiceMessage,
  ServerVoiceMessage,
  VoiceProvider,
  VoiceSessionStartOptions,
} from "../types.js";
import { VoiceWebSocketClient } from "../voice-ws.js";
import { pcm16OutputLevel, smoothAudioLevel } from "./audio-level.js";
import { createMicrophoneAudioNodes } from "./audio-nodes.js";
import { checkBrowserVoiceSupport } from "./support.js";
import type {
  BrowserVoiceSessionClientOptions,
  BrowserVoiceSessionSnapshot,
} from "./types.js";
import {
  addTranscript,
  cloneSnapshot,
  completeToolCall,
  INITIAL_SNAPSHOT,
} from "./snapshot.js";

export class BrowserVoiceSessionClient {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;
  private wsClient: VoiceWebSocketClient | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private muted = false;
  private lastOutputLevelAt = 0;
  private snapshot: BrowserVoiceSessionSnapshot = { ...INITIAL_SNAPSHOT };

  constructor(private readonly options: BrowserVoiceSessionClientOptions) {}

  get current(): BrowserVoiceSessionSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  async connect(
    options?: VoiceProvider | VoiceSessionStartOptions,
  ): Promise<void> {
    if (
      this.snapshot.state !== "idle" &&
      this.snapshot.state !== "ended" &&
      this.snapshot.state !== "error"
    ) {
      return;
    }

    const audioMode = this.options.audioMode ?? "microphone";
    if (audioMode === "microphone") {
      const support = checkBrowserVoiceSupport();
      if (!support.supported) {
        this.fail(support.reason ?? "Browser voice is not supported");
        return;
      }
    }

    this.muted = false;
    this.updateSnapshot({ ...INITIAL_SNAPSHOT, state: "connecting" });

    try {
      const audioNodes =
        audioMode === "microphone"
          ? await createMicrophoneAudioNodes(this.options.audio)
          : null;
      if (audioNodes) {
        this.audioContext = audioNodes.audioContext;
        this.mediaStream = audioNodes.mediaStream;
        this.captureNode = audioNodes.captureNode;
        this.playbackNode = audioNodes.playbackNode;
      }

      const wsClient = new VoiceWebSocketClient({
        onAudio: (buffer) => {
          this.publishOutputLevel(buffer);
          audioNodes?.playbackNode.port.postMessage(buffer, [buffer]);
        },
        onMessage: (message) => {
          this.handleServerMessage(message);
        },
        onOpen: () => {
          const startOptions =
            typeof options === "string"
              ? { provider: options }
              : (options ?? {});
          const message: ClientVoiceMessage = {
            type: "session.start",
            ...startOptions,
          };
          wsClient.sendControl(message);
        },
        onClose: () => {
          if (
            this.snapshot.state !== "idle" &&
            this.snapshot.state !== "ended"
          ) {
            this.updateSnapshot({ ...this.snapshot, state: "ended" });
          }
        },
        onError: () => {
          this.fail("WebSocket connection error");
        },
      });
      this.wsClient = wsClient;

      if (audioNodes) {
        audioNodes.captureNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (!this.muted) wsClient.sendAudio(event.data);
        };
      } else {
        this.startSilentAudioPump(wsClient);
      }

      this.startedAt = Date.now();
      this.durationTimer = setInterval(() => {
        this.updateSnapshot({
          ...this.snapshot,
          durationMs: Date.now() - this.startedAt,
        });
      }, 1000);

      wsClient.connect(await this.options.getWsUrl());
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "Failed to connect");
      await this.cleanupAudio();
    }
  }

  disconnect(): void {
    this.wsClient?.sendControl({ type: "session.end" });
    setTimeout(() => {
      this.wsClient?.disconnect();
      this.wsClient = null;
      void this.cleanupAudio();
      this.updateSnapshot({ ...INITIAL_SNAPSHOT });
    }, 100);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.updateSnapshot({ ...this.snapshot, isMuted: muted });
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  destroy(): void {
    this.wsClient?.disconnect();
    this.wsClient = null;
    void this.cleanupAudio();
    revokeWorkletURLs();
  }

  private handleServerMessage(message: ServerVoiceMessage): void {
    this.options.callbacks?.onMessage?.(message);

    switch (message.type) {
      case "session.started":
        this.updateSnapshot({
          ...this.snapshot,
          state: "listening",
          sessionId: message.sessionId,
          outputLevel: 0,
          error: null,
        });
        break;
      case "session.ended":
        this.updateSnapshot({ ...this.snapshot, state: "ended", outputLevel: 0 });
        break;
      case "learning.status":
        this.updateSnapshot({
          ...this.snapshot,
          learning: message.learning,
        });
        break;
      case "session.error":
        this.fail(message.error.message);
        break;
      case "state.change":
        this.updateSnapshot({
          ...this.snapshot,
          state: message.state,
          outputLevel:
            message.state === "speaking" ? this.snapshot.outputLevel : 0,
        });
        break;
      case "transcript":
        this.updateSnapshot(addTranscript(this.snapshot, message));
        break;
      case "tool.call":
        this.updateSnapshot({
          ...this.snapshot,
          state: "processing",
          toolCalls: [
            ...this.snapshot.toolCalls,
            {
              id: `tool_${Date.now()}`,
              name: message.tool.name,
              arguments: message.tool.arguments,
              result: null,
              status: "pending",
              timestamp: Date.now(),
            },
          ],
        });
        break;
      case "tool.result":
        this.updateSnapshot(
          completeToolCall(this.snapshot, message.tool.name, message.tool.result),
        );
        break;
    }
  }

  private async cleanupAudio(): Promise<void> {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.captureNode?.disconnect();
    this.captureNode = null;
    this.playbackNode?.disconnect();
    this.playbackNode = null;
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
    this.audioContext = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }

  private startSilentAudioPump(wsClient: VoiceWebSocketClient): void {
    const frame = new ArrayBuffer(960 * 2);
    this.silenceTimer = setInterval(() => {
      if (!this.muted) wsClient.sendAudio(frame.slice(0));
    }, 40);
  }

  private publishOutputLevel(buffer: ArrayBuffer): void {
    const now = performance.now();
    const outputLevel = smoothAudioLevel(
      this.snapshot.outputLevel,
      pcm16OutputLevel(buffer),
    );

    if (
      now - this.lastOutputLevelAt < 48 &&
      Math.abs(outputLevel - this.snapshot.outputLevel) < 0.035
    ) {
      return;
    }

    this.lastOutputLevelAt = now;
    this.updateSnapshot({ ...this.snapshot, outputLevel });
  }

  private fail(message: string): void {
    const error = new Error(message);
    this.options.callbacks?.onError?.(error);
    this.updateSnapshot({
      ...this.snapshot,
      state: "error",
      outputLevel: 0,
      error: message,
    });
  }

  private updateSnapshot(snapshot: BrowserVoiceSessionSnapshot): void {
    this.snapshot = snapshot;
    this.options.callbacks?.onSnapshot?.(this.current);
  }
}

export function createBrowserVoiceSessionClient(
  options: BrowserVoiceSessionClientOptions,
): BrowserVoiceSessionClient {
  return new BrowserVoiceSessionClient(options);
}
