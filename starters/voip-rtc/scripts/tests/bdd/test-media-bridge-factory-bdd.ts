import { createBrowserVoiceService } from "@voiceagentsdk/core/server/browser";
import type {
  AudioChunk,
  IVoiceSession,
  SessionEndReason,
  SessionState,
  VoiceSessionCallbacks,
  VoiceSessionConfig,
} from "@voiceagentsdk/core/server";
import type {
  BrowserVoiceMediaBridge,
  BrowserVoiceServiceConfig,
  BrowserVoiceSocket,
} from "@voiceagentsdk/core/server/browser";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioBrowserVoiceServiceUsesMediaBridgeFactory(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioBrowserVoiceServiceUsesMediaBridgeFactory() {
  const bridge = new FakeMediaBridge();
  const factoryInputs: MediaBridgeInput[] = [];
  const captured: { session?: FakeVoiceSession } = {};
  const config: BrowserVoiceServiceConfig = {
    createSession: async (_request, callbacks) => {
      captured.session = new FakeVoiceSession(callbacks);
      return captured.session;
    },
    media: {
      browserSampleRate: 24_000,
      llmInputSampleRate: 16_000,
      bridgeDefinition: {
        id: "browser",
        kind: "browser-websocket",
        sampleRate: 24_000,
      },
      bridgeFactory: {
        createMediaBridge(input) {
          factoryInputs.push(input);
          return bridge;
        },
      },
    },
  };
  const service = createBrowserVoiceService(config);
  const socket = new FakeSocket();

  service.handleBrowserStream(socket, { tenantId: "tenant-a", userId: "user-a" });
  await socket.emitText({
    type: "session.start",
    provider: "gemini",
    model: "gemini-test",
    voice: "Puck",
  });

  assert(factoryInputs.length === 1, "media bridge factory must be called once");
  const input = factoryInputs.at(0);
  assert(
    input?.definition.kind === "browser-websocket",
    "factory input must include the media bridge definition",
  );
  assert(input.browserSampleRate === 24_000, "factory input must include browser rate");
  assert(input.llmInputSampleRate === 16_000, "factory input must include LLM rate");
  assert(bridge.events.includes("onAudioToLlm"), "bridge must register LLM audio input");
  assert(bridge.events.includes("start"), "bridge must start after session start");

  await socket.emitBinary(Buffer.from([1, 0, 2, 0]));
  assert(
    captured.session?.audioInputs.length === 1,
    "browser audio must reach the session through onAudioToLlm",
  );

  captured.session?.callbacks.onAudioOutput?.(audioChunk(Buffer.from([3, 0])));
  assert(bridge.outputChunks.length === 1, "LLM output must use bridge sendAudio");

  captured.session?.callbacks.onInterrupted?.();
  assert(bridge.events.includes("clearOutput"), "interrupts must clear bridge output");

  await socket.emitText({ type: "session.end" });
  assert(bridge.events.includes("stop"), "bridge must stop when the session ends");

  return "browser-voice-service-uses-media-bridge-factory";
}

function audioChunk(payload: Buffer): AudioChunk {
  return {
    payload,
    encoding: "pcm16",
    sampleRate: 24_000,
    channels: 1,
    timestamp: Date.now(),
  };
}

type MediaBridgeInput = Parameters<
  NonNullable<
    NonNullable<BrowserVoiceServiceConfig["media"]>["bridgeFactory"]
  >["createMediaBridge"]
>[0];

class FakeMediaBridge implements BrowserVoiceMediaBridge {
  readonly events: string[] = [];
  readonly outputChunks: AudioChunk[] = [];
  private audioToLlm: ((chunk: AudioChunk) => void) | undefined;

  start(): void {
    this.events.push("start");
  }

  stop(): void {
    this.events.push("stop");
  }

  ingestAudio(buffer: Buffer): void {
    this.events.push("ingestAudio");
    this.audioToLlm?.(audioChunk(buffer));
  }

  sendAudio(chunk: AudioChunk): void {
    this.events.push("sendAudio");
    this.outputChunks.push(chunk);
  }

  clearOutput(): void {
    this.events.push("clearOutput");
  }

  onAudioToLlm(handler: (chunk: AudioChunk) => void): void {
    this.events.push("onAudioToLlm");
    this.audioToLlm = handler;
  }
}

class FakeVoiceSession implements IVoiceSession {
  readonly sessionId = "session-media-bridge";
  readonly config: VoiceSessionConfig = {
    sessionId: this.sessionId,
    channel: "voice",
    providerId: "gemini",
    sampleRate: 16_000,
  };
  readonly audioInputs: Buffer[] = [];
  state: SessionState = "initializing";

  constructor(readonly callbacks: VoiceSessionCallbacks) {}

  async start(): Promise<void> {
    this.state = "listening";
    this.callbacks.onStateChange?.("listening");
  }

  async end(_reason?: SessionEndReason): Promise<void> {
    this.state = "ended";
  }

  handleAudio(chunk: Buffer): void {
    this.audioInputs.push(chunk);
  }

  interrupt(): void {
    this.callbacks.onInterrupted?.();
  }
}

class FakeSocket implements BrowserVoiceSocket {
  readonly sent: Array<string | Buffer> = [];
  readyState = 1;
  private readonly messageHandlers: Array<
    (data: unknown, isBinary?: boolean) => void | Promise<void>
  > = [];
  private readonly closeHandlers: Array<() => void | Promise<void>> = [];
  private readonly errorHandlers: Array<(error: unknown) => void | Promise<void>> = [];

  send(data: string | Buffer): void {
    this.sent.push(data);
  }

  close(): void {}

  on(
    event: "message" | "close" | "error",
    handler:
      | ((data: unknown, isBinary?: boolean) => void | Promise<void>)
      | (() => void | Promise<void>)
      | ((error: unknown) => void | Promise<void>),
  ): this {
    if (event === "message") {
      this.messageHandlers.push(
        handler as (data: unknown, isBinary?: boolean) => void | Promise<void>,
      );
    } else if (event === "close") {
      this.closeHandlers.push(handler as () => void | Promise<void>);
    } else {
      this.errorHandlers.push(handler as (error: unknown) => void | Promise<void>);
    }
    return this;
  }

  async emitText(message: Record<string, unknown>): Promise<void> {
    await this.emitMessage(JSON.stringify(message), false);
  }

  async emitBinary(buffer: Buffer): Promise<void> {
    await this.emitMessage(buffer, true);
  }

  private async emitMessage(data: unknown, isBinary: boolean): Promise<void> {
    await Promise.all(
      this.messageHandlers.map((handler) => handler(data, isBinary)),
    );
  }
}
