import {
  runCascadedLlmWithTts,
  type CascadedPipelineState,
} from "../../../src/server/agent/transports/cascaded/pipeline.js";
import type {
  ILLM,
  LlmMessage,
  LlmStreamEvent,
  LlmToolDefinition,
} from "../../../src/server/agent/transports/cascaded/types.js";
import type { AgentLogger } from "../../../src/server/agent/utils/logger.js";

const results = [
  await scenarioDroppedToolCallbackTimesOut(),
  await scenarioDefaultToolCallbackTimeoutIsTwoMinutes(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioDroppedToolCallbackTimesOut() {
  const functionCalls: string[] = [];
  let completed = false;
  const state: CascadedPipelineState & { toolResultTimeoutMs: number } = {
    stt: null,
    llm: new ToolTimeoutLlm(),
    tts: null,
    history: [{ role: "user", content: "Need a tool." }],
    tools: [toolDefinition()],
    handlers: {
      onAudio: null,
      onFunctionCall: (call) => {
        functionCalls.push(call.callId);
      },
      onSpeechStarted: null,
      onSpeechStopped: null,
      onResponseStarted: null,
      onResponseCompleted: () => {
        completed = true;
      },
      onTranscript: null,
      onError: null,
    },
    activeAborts: new Set<AbortController>(),
    pendingToolResults: new Map<string, (result: unknown) => void>(),
    currentResponseItemId: null,
    logger: silentLogger(),
    toolResultTimeoutMs: 10,
  };

  const outcome = await Promise.race([
    runCascadedLlmWithTts(state, "response-timeout-test").then(() => "completed"),
    delay(120).then(() => "hung"),
  ]);

  assert(outcome === "completed", "cascaded pipeline must not hang on a dropped tool callback");
  assert(completed, "cascaded pipeline must complete the response after timeout recovery");
  assert(functionCalls.join(",") === "tool-timeout", "tool call must still be emitted");
  assert(state.pendingToolResults.size === 0, "timed-out tool resolver must be removed");

  const toolMessage = state.history.find((message) =>
    message.role === "tool" && message.tool_call_id === "tool-timeout"
  );
  assert(Boolean(toolMessage), "timeout must be recorded as a tool message");
  assert(
    typeof toolMessage?.content === "string" && toolMessage.content.includes("timed out"),
    `timeout tool message must explain the timeout, got ${String(toolMessage?.content)}`,
  );

  return "dropped-tool-callback-times-out";
}

async function scenarioDefaultToolCallbackTimeoutIsTwoMinutes() {
  const observedTimeouts: number[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof timeout === "number") observedTimeouts.push(timeout);
    return originalSetTimeout(handler, 0, ...args);
  }) as typeof globalThis.setTimeout;

  try {
    const state: CascadedPipelineState = {
      stt: null,
      llm: new ToolTimeoutLlm(),
      tts: null,
      history: [{ role: "user", content: "Need a tool." }],
      tools: [toolDefinition()],
      handlers: {
        onAudio: null,
        onFunctionCall: () => {},
        onSpeechStarted: null,
        onSpeechStopped: null,
        onResponseStarted: null,
        onResponseCompleted: null,
        onTranscript: null,
        onError: null,
      },
      activeAborts: new Set<AbortController>(),
      pendingToolResults: new Map<string, (result: unknown) => void>(),
      currentResponseItemId: null,
      logger: silentLogger(),
    };

    await runCascadedLlmWithTts(state, "response-default-timeout-test");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert(
    observedTimeouts.includes(120_000),
    `default cascaded tool callback timeout must be 120000ms, got ${observedTimeouts.join(",")}`,
  );

  return "default-tool-callback-timeout-is-two-minutes";
}

class ToolTimeoutLlm implements ILLM {
  private streamCount = 0;

  async *stream(
    _messages: LlmMessage[],
    _tools: LlmToolDefinition[],
    _signal?: AbortSignal,
  ): AsyncGenerator<LlmStreamEvent> {
    this.streamCount += 1;
    if (this.streamCount === 1) {
      yield {
        type: "tool_call_delta",
        index: 0,
        callId: "tool-timeout",
        name: "lookup_order",
        argsDelta: "{}",
      };
      yield { type: "stream_done", finishReason: "tool_calls" };
      return;
    }

    yield { type: "text_delta", delta: "I could not get the tool result." };
    yield { type: "stream_done", finishReason: "stop" };
  }
}

function toolDefinition(): LlmToolDefinition {
  return {
    type: "function",
    name: "lookup_order",
    description: "Look up an order.",
    parameters: { type: "object" },
  };
}

function silentLogger(): AgentLogger {
  const logger: AgentLogger = {
    debug(_msg, _ctx): void {},
    info(_msg, _ctx): void {},
    warn(_msg, _ctx): void {},
    error(_msg, _error, _ctx): void {},
    child(_ctx): AgentLogger {
      return logger;
    },
  };
  return logger;
}

function delay(ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve("hung"), ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
