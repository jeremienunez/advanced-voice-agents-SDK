import {
  createBrowserVoiceService,
  createConsoleEventSink,
  createConsoleLoggerPort,
  noopEventSink,
  noopLogger,
  type AudioChunk,
  type BrowserVoiceMediaBridge,
  type BrowserVoiceServiceConfig,
  type BrowserVoiceSocket,
  type IVoiceSession,
  type ServerVoiceMessage,
  type SessionEndReason,
  type SessionState,
  type VoiceSessionCallbacks,
  type VoiceSessionConfig,
} from "@voiceagentsdk/core/server";
import type { EventSinkPort } from "@voiceagentsdk/core/sdk";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioBrowserVoiceEventsUseInjectableSink(),
  scenarioConsoleLoggerRedactsSensitiveContext(),
  scenarioNoopPortsAreSubstitutable(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioBrowserVoiceEventsUseInjectableSink(): Promise<string> {
  const events: ServerVoiceMessage[] = [];
  const socket = new FakeSocket();
  const service = createBrowserVoiceService({
    createSession: async (_request, callbacks) => new FakeVoiceSession(callbacks),
    eventSink: captureEventSink(events),
    logger: noopLogger,
    media: { bridgeFactory: { createMediaBridge: () => new FakeMediaBridge() } },
    onSessionEnded: (_input, emitStatus) => {
      emitStatus({
        jobId: "job-event-sink",
        runId: "run-event-sink",
        status: "queued",
        queuedAt: new Date(0).toISOString(),
      });
    },
  });

  service.handleBrowserStream(socket, { tenantId: "tenant-a", userId: "user-a" });
  await socket.emitText({ type: "session.start", provider: "gemini" });
  await socket.emitText({ type: "session.end" });
  await Promise.resolve();

  const eventTypes = events.map((event) => event.type);
  assert(eventTypes.includes("session.started"), "sink must receive session start");
  assert(eventTypes.includes("state.change"), "sink must receive state changes");
  assert(eventTypes.includes("tool.call"), "sink must receive tool call events");
  assert(eventTypes.includes("tool.result"), "sink must receive tool result events");
  assert(eventTypes.includes("session.error"), "sink must receive session errors");
  assert(eventTypes.includes("session.ended"), "sink must receive session end");
  assert(eventTypes.includes("learning.status"), "sink must receive learning status");
  assert(socket.controlTypes().join(",") === eventTypes.join(","), "socket control flow must stay unchanged");

  return "browser-voice-events-use-injectable-sink";
}

function scenarioConsoleLoggerRedactsSensitiveContext(): string {
  const lines = captureConsole(() => {
    createConsoleLoggerPort({ service: "bdd" }).info("redaction check", {
      token: "live-token",
      prompt: "sensitive prompt",
      nested: { apiKey: "live-key", message: "private message" },
    });
  });
  const output = lines.join("\n");

  assert(output.includes("[REDACTED]"), "logger must keep redaction marker");
  assert(!output.includes("live-token"), "logger must redact tokens");
  assert(!output.includes("sensitive prompt"), "logger must redact prompts");
  assert(!output.includes("live-key"), "logger must redact nested API keys");
  assert(!output.includes("private message"), "logger must redact nested messages");

  const eventLines = captureConsole(() => {
    createConsoleEventSink().emit({
      type: "session.error",
      error: { code: "bad", message: "hide me" },
    });
  });
  assert(eventLines.join("\n").includes("browser voice event"), "console sink must log events");

  return "console-logger-redacts-sensitive-context";
}

function scenarioNoopPortsAreSubstitutable(): string {
  noopEventSink.emit({ type: "state.change", state: "listening" });
  noopLogger
    .child({ token: "ignored" })
    .error("ignored error", { prompt: "ignored prompt" });
  return "noop-ports-are-substitutable";
}

function captureEventSink(
  events: ServerVoiceMessage[],
): EventSinkPort<ServerVoiceMessage> {
  return {
    emit(event) {
      events.push(event);
    },
  };
}

function captureConsole(action: () => void): string[] {
  const previous = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    action();
  } finally {
    console.log = previous;
  }
  return lines;
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

class FakeMediaBridge implements BrowserVoiceMediaBridge {
  private audioToLlm: ((chunk: AudioChunk) => void) | undefined;

  start(): void {}
  stop(): void {}
  sendAudio(_chunk: AudioChunk): void {}
  clearOutput(): void {}

  ingestAudio(buffer: Buffer): void {
    this.audioToLlm?.(audioChunk(buffer));
  }

  onAudioToLlm(handler: (chunk: AudioChunk) => void): void {
    this.audioToLlm = handler;
  }
}

class FakeVoiceSession implements IVoiceSession {
  readonly sessionId = "session-event-sink";
  readonly config: VoiceSessionConfig = {
    sessionId: this.sessionId,
    channel: "voice",
    providerId: "gemini",
    sampleRate: 24_000,
  };
  state: SessionState = "initializing";

  constructor(readonly callbacks: VoiceSessionCallbacks) {}

  async start(): Promise<void> {
    this.state = "listening";
    this.callbacks.onStateChange?.("listening");
    this.callbacks.onToolCall?.({
      callId: "call-a",
      toolName: "lookup",
      arguments: { query: "hello" },
      startedAt: Date.now(),
      status: "executing",
    });
    this.callbacks.onToolCall?.({
      callId: "call-a",
      toolName: "lookup",
      arguments: { query: "hello" },
      startedAt: Date.now(),
      status: "completed",
      result: { ok: true },
    });
    this.callbacks.onError?.({
      name: "AgentError",
      code: "simulated",
      message: "simulated failure",
    } as never);
  }

  async end(_reason?: SessionEndReason): Promise<void> {
    this.state = "ended";
  }

  handleAudio(_chunk: Buffer): void {}
  interrupt(): void {}
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
    await Promise.all(
      this.messageHandlers.map((handler) =>
        handler(JSON.stringify(message), false),
      ),
    );
  }

  controlTypes(): string[] {
    return this.sent
      .filter((item): item is string => typeof item === "string")
      .map((item) => JSON.parse(item) as ServerVoiceMessage)
      .map((message) => message.type);
  }
}
