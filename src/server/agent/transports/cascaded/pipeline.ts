import type { AgentLogger } from "../../utils/index.js";
import { SentenceBuffer } from "./sentence-buffer.js";
import type {
  ILLM,
  ISTT,
  ITTS,
  LlmMessage,
  LlmToolDefinition,
} from "./types.js";
import type { CascadedHandlers } from "./handlers.js";

export interface CascadedPipelineState {
  stt: ISTT | null;
  llm: ILLM;
  tts: ITTS | null;
  history: LlmMessage[];
  tools: LlmToolDefinition[];
  handlers: CascadedHandlers;
  activeAborts: Set<AbortController>;
  pendingToolResults: Map<string, (result: unknown) => void>;
  currentResponseItemId: string | null;
  logger: AgentLogger;
}

export async function processCascadedTurn(
  state: CascadedPipelineState,
  audioBuffer: Buffer,
): Promise<void> {
  const responseId = `cascaded-${Date.now()}`;
  const startMs = Date.now();

  try {
    if (state.stt) {
      const abort = createAbort(state);
      const sttStart = Date.now();
      const transcript = await state.stt.transcribe(audioBuffer, abort.signal);
      removeAbort(state, abort);

      state.logger.info("STT complete", {
        transcript: transcript.slice(0, 80),
        latencyMs: Date.now() - sttStart,
      });

      if (!transcript.trim()) return;
      state.handlers.onTranscript?.(transcript, true);
      state.history.push({ role: "user", content: transcript });
    } else {
      state.history.push({
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: audioBuffer.toString("base64"),
              format: "pcm16",
            },
          },
        ],
      });
    }

    await runCascadedLlmWithTts(state, responseId);
    state.logger.info("Turn complete", {
      responseId,
      totalLatencyMs: Date.now() - startMs,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") return;
    state.logger.error("processTurn error", { error, responseId });
    state.handlers.onError?.({
      code: "cascaded_pipeline_error",
      message: String(error),
    });
  }
}

export async function runCascadedLlmWithTts(
  state: CascadedPipelineState,
  responseId: string,
  iteration = 0,
): Promise<void> {
  if (iteration > 5) {
    state.logger.warn("Max tool iterations reached", { responseId });
    state.handlers.onResponseCompleted?.(responseId);
    return;
  }

  if (iteration === 0) {
    state.currentResponseItemId = responseId;
    state.handlers.onResponseStarted?.(responseId);
  }

  const abort = createAbort(state);
  const sentenceBuffer = new SentenceBuffer();
  const toolCalls = new Map<
    number,
    { callId: string; name: string; args: string }
  >();
  let assistantText = "";
  let finishReason: "stop" | "tool_calls" = "stop";
  const ttsQueue: Promise<void>[] = [];

  const dispatchTts = (sentence: string): void => {
    const tts = state.tts;
    if (!sentence.trim() || !tts) return;
    const ttsAbort = createAbort(state);
    const promise = streamTts(state, tts, sentence, ttsAbort);
    ttsQueue.push(promise);
  };

  try {
    for await (const event of state.llm.stream(
      state.history,
      state.tools,
      abort.signal,
    )) {
      switch (event.type) {
        case "text_delta": {
          assistantText += event.delta;
          const sentence = sentenceBuffer.push(event.delta);
          if (sentence) dispatchTts(sentence);
          break;
        }
        case "audio_delta":
          state.handlers.onAudio?.(event.chunk);
          break;
        case "tool_call_delta":
          mergeToolCallDelta(toolCalls, event);
          break;
        case "stream_done":
          finishReason = event.finishReason;
          break;
      }
    }
  } finally {
    removeAbort(state, abort);
  }

  const remaining = sentenceBuffer.flush();
  if (remaining) dispatchTts(remaining);
  await Promise.all(ttsQueue);

  if (finishReason === "tool_calls" && toolCalls.size > 0) {
    await handleToolCalls(state, responseId, iteration, assistantText, toolCalls);
    return;
  }

  if (assistantText) {
    state.history.push({ role: "assistant", content: assistantText });
  }

  state.currentResponseItemId = null;
  state.handlers.onResponseCompleted?.(responseId);
}

export function submitCascadedToolResult(
  state: CascadedPipelineState,
  callId: string,
  result: unknown,
): boolean {
  const resolver = state.pendingToolResults.get(callId);
  if (!resolver) return false;
  resolver(result);
  state.pendingToolResults.delete(callId);
  return true;
}

export function cancelCascadedInFlight(state: CascadedPipelineState): void {
  for (const abort of state.activeAborts) {
    abort.abort();
  }
  state.activeAborts.clear();

  for (const [, resolver] of state.pendingToolResults) {
    resolver({ error: "cancelled" });
  }
  state.pendingToolResults.clear();
}

function createAbort(state: CascadedPipelineState): AbortController {
  const abort = new AbortController();
  state.activeAborts.add(abort);
  return abort;
}

function removeAbort(
  state: CascadedPipelineState,
  abort: AbortController,
): void {
  state.activeAborts.delete(abort);
}

async function streamTts(
  state: CascadedPipelineState,
  tts: ITTS,
  sentence: string,
  abort: AbortController,
): Promise<void> {
  try {
    for await (const chunk of tts.stream(sentence, abort.signal)) {
      state.handlers.onAudio?.(chunk);
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      state.logger.error("TTS error", { err: String(err) });
    }
  } finally {
    removeAbort(state, abort);
  }
}

function mergeToolCallDelta(
  toolCalls: Map<number, { callId: string; name: string; args: string }>,
  event: {
    index: number;
    callId?: string;
    name?: string;
    argsDelta: string;
  },
): void {
  const existing = toolCalls.get(event.index);
  if (existing) {
    existing.args += event.argsDelta;
    if (event.callId) existing.callId = event.callId;
    if (event.name) existing.name = event.name;
    return;
  }
  toolCalls.set(event.index, {
    callId: event.callId ?? "",
    name: event.name ?? "",
    args: event.argsDelta,
  });
}

async function handleToolCalls(
  state: CascadedPipelineState,
  responseId: string,
  iteration: number,
  assistantText: string,
  toolCalls: Map<number, { callId: string; name: string; args: string }>,
): Promise<void> {
  const toolCallsList = [...toolCalls.values()].map((tc) => ({
    id: tc.callId,
    type: "function" as const,
    function: { name: tc.name, arguments: tc.args },
  }));

  state.history.push({
    role: "assistant",
    content: assistantText || null,
    tool_calls: toolCallsList,
  });

  for (const tc of toolCalls.values()) {
    state.logger.info("Tool call", { name: tc.name, callId: tc.callId });
    state.handlers.onFunctionCall?.({
      callId: tc.callId,
      name: tc.name,
      arguments: tc.args,
    });
    const result = await waitForToolResult(state, tc.callId);
    state.history.push({
      role: "tool",
      content: JSON.stringify(result),
      tool_call_id: tc.callId,
    });
  }

  await runCascadedLlmWithTts(state, responseId, iteration + 1);
}

function waitForToolResult(
  state: CascadedPipelineState,
  callId: string,
): Promise<unknown> {
  return new Promise((resolve) => {
    state.pendingToolResults.set(callId, resolve);
  });
}
