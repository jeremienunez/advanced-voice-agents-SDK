import {
  createRealtimeVoiceSession,
  type AudioChunk,
  type IRealtimeProvider,
  type ProviderError,
  type ProviderFunctionCall,
  type RealtimeSessionUpdate,
  type TransportState,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioModelConfirmedArgumentCannotExecuteWriteTool(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioModelConfirmedArgumentCannotExecuteWriteTool() {
  const provider = new FakeRealtimeProvider();
  const calls: unknown[] = [];
  let resolveCompleted!: () => void;
  const completed = new Promise<void>((resolve) => {
    resolveCompleted = resolve;
  });
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-self-confirm-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      providerId: "fake",
    },
    {
      provider,
      tools: [writeTool(calls)],
    },
    {
      onToolCall: (call) => {
        if (call.status === "completed") {
          resolveCompleted();
        }
      },
    },
  );

  await session.start();
  const resultPromise = provider.waitForResult();
  provider.emitFunctionCall({
    callId: "call-self-confirm",
    name: "schedule_follow_up",
    arguments: JSON.stringify({
      topic: "Call the customer",
      dueAt: "2026-06-01T10:00:00Z",
      confirmed: true,
    }),
  });
  const result = await resultPromise as Record<string, unknown>;
  await completed;
  await session.end();

  assert(
    calls.length === 0,
    "model-supplied confirmed=true must not execute the write handler",
  );
  assert(
    result.status === "confirmation_required",
    `write tool must return confirmation_required, got ${JSON.stringify(result)}`,
  );
  assert(
    typeof result.pendingActionId === "string" &&
      result.pendingActionId.length > 0,
    "confirmation_required result must expose a server pending action id",
  );

  return "model-confirmed-argument-cannot-execute-write-tool";
}

function writeTool(calls: unknown[]): VoiceSessionTool {
  return {
    type: "function",
    name: "schedule_follow_up",
    description: "Schedule a follow-up task.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
        dueAt: { type: "string" },
      },
      required: ["topic"],
    },
    policy: {
      sideEffect: "write",
      executionMode: "confirmation",
      confirmationReason: "Write side effect.",
    },
    execute: async (args) => {
      calls.push(args);
      return { status: "follow_up_scheduled" };
    },
  };
}

class FakeRealtimeProvider implements IRealtimeProvider {
  readonly providerId = "fake-self-confirm";
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
