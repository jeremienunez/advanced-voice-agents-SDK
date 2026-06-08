import {
  createRealtimeVoiceSession,
  type AudioChunk,
  type IRealtimeProvider,
  type ProviderError,
  type ProviderFunctionCall,
  type RealtimeSessionUpdate,
  type TransportState,
} from "@voiceagentsdk/core/server";

class FakeRealtimeProvider implements IRealtimeProvider {
  readonly providerId = "fake";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;
  private functionHandler: ((call: ProviderFunctionCall) => void) | null = null;
  private resultResolver: ((value: unknown) => void) | null = null;

  get isConnected(): boolean {
    return this.state === "connected";
  }

  async connect(): Promise<void> {
    this.state = "connected";
  }

  async disconnect(): Promise<void> {
    this.state = "disconnected";
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }

  async sendAudio(_chunk: AudioChunk): Promise<void> {}
  onAudio(_handler: (chunk: AudioChunk) => void): void {}
  async updateSession(_config: RealtimeSessionUpdate): Promise<void> {}
  async createResponse(_options?: Record<string, unknown>): Promise<void> {}
  async cancelResponse(): Promise<void> {}
  async truncateResponse(
    _itemId: string,
    _contentIndex: number,
    _audioEndMs: number,
  ): Promise<void> {}

  async submitFunctionResult(
    _callId: string,
    result: unknown,
    _triggerResponse?: boolean,
  ): Promise<void> {
    this.resultResolver?.(result);
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.functionHandler = handler;
  }

  onSpeechStarted(_handler: () => void): void {}
  onSpeechStopped(_handler: (audioEndMs?: number) => void): void {}
  onResponseStarted(_handler: (responseId: string) => void): void {}
  onResponseCompleted(_handler: (responseId: string) => void): void {}
  onTranscript(_handler: (text: string, isFinal: boolean) => void): void {}
  onError(_handler: (error: ProviderError) => void): void {}

  emitFunctionCall(call: ProviderFunctionCall): void {
    this.functionHandler?.(call);
  }

  waitForResult(): Promise<unknown> {
    return new Promise((resolve) => {
      this.resultResolver = resolve;
    });
  }
}

const provider = new FakeRealtimeProvider();
const toolEvents: string[] = [];
const states: string[] = [];
let completeToolEvent: (() => void) | null = null;
const completeToolEventPromise = new Promise<void>((resolve) => {
  completeToolEvent = resolve;
});
const session = createRealtimeVoiceSession(
  {
    sessionId: "tool_test",
    tenantId: "local",
    userId: "runtime-test",
    channel: "voice",
    providerId: "fake",
    inputFormat: "pcm16",
    sampleRate: 24000,
  },
  {
    provider,
    tools: [
      {
        type: "function",
        name: "search_knowledge",
        description: "Test tool",
        parameters: { type: "object" },
        execute: async (args) => ({ status: "ok", args }),
      },
    ],
  },
  {
    onToolCall: (call) => {
      toolEvents.push(call.status);
      if (call.status === "completed") completeToolEvent?.();
    },
    onStateChange: (state) => states.push(state),
  },
);

await session.start();
const resultPromise = provider.waitForResult();
provider.emitFunctionCall({
  callId: "call_1",
  name: "search_knowledge",
  arguments: JSON.stringify({ query: "Bordeaux" }),
});
const result = await resultPromise;
await completeToolEventPromise;
await session.end();

assert(JSON.stringify(result).includes("Bordeaux"), "tool result missing args");
assert(toolEvents.join(",") === "pending,executing,completed", "bad tool states");
assert(states.includes("processing_tool"), "processing_tool state not emitted");

console.log(
  JSON.stringify(
    { status: "ok", result, toolEvents, states },
    null,
    2,
  ),
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
