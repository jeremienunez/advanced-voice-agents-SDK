import {
  createInMemoryPendingActionPort,
  createRealtimeVoiceSession,
  ToolExecutionPolicyEngine,
  type AudioChunk,
  type IRealtimeProvider,
  type ProviderError,
  type ProviderFunctionCall,
  type RealtimeSessionUpdate,
  type TransportState,
  type VoiceSessionTool,
} from "../../../src/server/index.js";

const results = [
  await scenarioConfirmationRequiredDoesNotBecomeModelVisibleToolResult(),
  await scenarioDomainStatusConfirmationRequiredStillSubmitsForAutomaticTool(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioConfirmationRequiredDoesNotBecomeModelVisibleToolResult() {
  const provider = new RecordingRealtimeProvider();
  const handlerCalls: unknown[] = [];
  const toolEvents: string[] = [];
  const pendingActions = createInMemoryPendingActionPort({
    idFactory: () => "pending-confirmation-boundary",
  });
  const policy = new ToolExecutionPolicyEngine({ pendingActions });
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-confirmation-boundary-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      agentId: "agent-a",
      channel: "voice",
      providerId: "fake",
    },
    {
      provider,
      toolPolicyEngine: policy,
      tools: [writeTool(handlerCalls)],
    },
    {
      onToolCall: (call) => {
        toolEvents.push(call.status);
      },
    },
  );

  await session.start();
  provider.emitFunctionCall({
    callId: "call-needs-confirmation",
    name: "schedule_follow_up",
    arguments: JSON.stringify({ topic: "Call the customer" }),
  });

  await waitFor(() =>
    provider.submittedResults.length > 0 ||
    toolEvents.includes("awaiting_confirmation") ||
    toolEvents.includes("completed") ||
    toolEvents.includes("failed")
  );
  await session.end();

  const pending = await pendingActions.get?.("pending-confirmation-boundary");
  assert(
    handlerCalls.length === 0,
    "confirmation-required tool handler must not execute before approval",
  );
  assert(
    pending?.status === "confirmation_required",
    "voice session must leave the action in the pending approval store",
  );
  assert(
    provider.submittedResults.length === 0,
    `confirmation_required must not be submitted as a model-visible tool result, got ${
      JSON.stringify(provider.submittedResults)
    }`,
  );
  assert(
    toolEvents.join(",") === "pending,executing,awaiting_confirmation",
    `confirmation-required tool must remain awaiting approval, got ${toolEvents.join(",")}`,
  );

  return "confirmation-required-is-not-submitted-to-model";
}

async function scenarioDomainStatusConfirmationRequiredStillSubmitsForAutomaticTool() {
  const provider = new RecordingRealtimeProvider();
  const toolEvents: string[] = [];
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-domain-status-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      providerId: "fake",
    },
    {
      provider,
      tools: [
        {
          type: "function",
          name: "lookup_status",
          description: "Look up a domain status.",
          parameters: { type: "object" },
          policy: { sideEffect: "read", executionMode: "automatic" },
          execute: async () => ({
            status: "confirmation_required",
            source: "domain-data",
          }),
        },
      ],
    },
    {
      onToolCall: (call) => {
        toolEvents.push(call.status);
      },
    },
  );

  await session.start();
  provider.emitFunctionCall({
    callId: "call-domain-status",
    name: "lookup_status",
    arguments: "{}",
  });

  await waitFor(() => provider.submittedResults.length > 0);
  await session.end();

  assert(
    provider.submittedResults.length === 1,
    "automatic tool domain status must still be submitted as a normal result",
  );
  assert(
    JSON.stringify(provider.submittedResults[0]?.result).includes("domain-data"),
    "automatic tool domain result must be preserved",
  );
  assert(
    toolEvents.join(",") === "pending,executing,completed",
    `automatic tool must complete normally, got ${toolEvents.join(",")}`,
  );

  return "domain-status-confirmation-required-submits-for-automatic-tool";
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

class RecordingRealtimeProvider implements IRealtimeProvider {
  readonly providerId = "fake-confirmation-boundary";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;
  readonly submittedResults: Array<{ callId: string; result: unknown; triggerResponse?: boolean }> = [];
  private functionHandler: ((call: ProviderFunctionCall) => void) | null = null;

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
    callId: string,
    result: unknown,
    triggerResponse?: boolean,
  ): Promise<void> {
    this.submittedResults.push({ callId, result, triggerResponse });
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
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 250,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for voice session tool state");
    }
    await delay(5);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
