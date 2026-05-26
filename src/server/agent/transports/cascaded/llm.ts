/**
 * LLM Implementations — TextChatLLM + AudioChatLLM
 *
 * TextChatLLM: text-only Chat Completions streaming (cascade mode)
 * AudioChatLLM: audio input + text/audio output (moe-stt / moe-full modes)
 * Both share SSE stream parsing logic.
 */

import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type { AudioChunk } from "../../types/transport.types.js";
import type {
  ILLM,
  LlmMessage,
  LlmStreamEvent,
  LlmToolDefinition,
} from "./types.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

interface LlmConfig {
  temperature: number;
  maxTokens: number;
}

// =============================================================================
// TextChatLLM — cascade mode (text-only messages)
// =============================================================================

export class TextChatLLM implements ILLM {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly config: LlmConfig,
  ) {}

  async *stream(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<LlmStreamEvent> {
    const body = buildRequestBody(this.model, messages, tools, this.config, [
      "text",
    ]);

    yield* streamSse(this.apiKey, body, signal);
  }
}

// =============================================================================
// AudioChatLLM — moe-stt + moe-full modes (audio input, text/audio output)
// =============================================================================

export class AudioChatLLM implements ILLM {
  private readonly audioOutput: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly config: LlmConfig & { audioOutput: boolean },
  ) {
    this.audioOutput = config.audioOutput;
  }

  async *stream(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<LlmStreamEvent> {
    const modalities: string[] = this.audioOutput
      ? ["text", "audio"]
      : ["text"];

    const body = buildRequestBody(
      this.model,
      messages,
      tools,
      this.config,
      modalities,
    );

    // Audio output config
    if (this.audioOutput) {
      body.audio = { voice: "alloy", format: "pcm16" };
    }

    yield* streamSse(this.apiKey, body, signal);
  }
}

// =============================================================================
// Shared: Request Body Builder
// =============================================================================

function buildRequestBody(
  model: string,
  messages: LlmMessage[],
  tools: LlmToolDefinition[],
  config: LlmConfig,
  modalities: string[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map(serializeMessage),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
    stream_options: { include_usage: false },
    parallel_tool_calls: false,
  };

  if (modalities.length > 0) {
    body.modalities = modalities;
  }

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = "auto";
  }

  return body;
}

function serializeMessage(msg: LlmMessage): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    role: msg.role,
    content: msg.content,
  };
  if (msg.tool_calls) serialized.tool_calls = msg.tool_calls;
  if (msg.tool_call_id) serialized.tool_call_id = msg.tool_call_id;
  return serialized;
}

// =============================================================================
// Shared: SSE Stream Parser
// =============================================================================

async function* streamSse(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<LlmStreamEvent> {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new AgentError({
      code: ERROR_CODES.OPENAI_RESPONSE_ERROR,
      message: `Chat Completions stream failed: HTTP ${response.status} — ${errText}`,
      recoverable: response.status >= 500,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let partial = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    partial += decoder.decode(value, { stream: true });
    const lines = partial.split("\n");
    partial = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // malformed chunk
      }

      yield* parseSseChunk(parsed);
    }
  }
}

function* parseSseChunk(
  parsed: Record<string, unknown>,
): Iterable<LlmStreamEvent> {
  const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
  if (!choices?.length) return;

  const choice = choices[0];
  const delta = choice.delta as Record<string, unknown> | undefined;
  const finishReason = choice.finish_reason as string | null | undefined;

  // Text content delta
  if (delta?.content && typeof delta.content === "string") {
    yield { type: "text_delta", delta: delta.content };
  }

  // Audio output delta (moe-full mode)
  if (delta?.audio) {
    const audio = delta.audio as Record<string, unknown>;
    if (audio.data && typeof audio.data === "string") {
      const pcmBuffer = Buffer.from(audio.data, "base64");
      const chunk: AudioChunk = {
        payload: pcmBuffer,
        encoding: "pcm16",
        sampleRate: 24000,
        channels: 1,
        timestamp: Date.now(),
      };
      yield { type: "audio_delta", chunk };
    }
  }

  // Tool call deltas
  const toolCalls = delta?.tool_calls as
    | Array<Record<string, unknown>>
    | undefined;
  if (toolCalls) {
    for (const tc of toolCalls) {
      const fn = (tc.function as Record<string, unknown>) ?? {};
      yield {
        type: "tool_call_delta",
        index: (tc.index as number) ?? 0,
        callId: (tc.id as string) || undefined,
        name: (fn.name as string) || undefined,
        argsDelta: (fn.arguments as string) ?? "",
      };
    }
  }

  // Finish reasons
  if (finishReason === "stop") {
    yield { type: "stream_done", finishReason: "stop" };
  } else if (finishReason === "tool_calls") {
    yield { type: "stream_done", finishReason: "tool_calls" };
  }
}
