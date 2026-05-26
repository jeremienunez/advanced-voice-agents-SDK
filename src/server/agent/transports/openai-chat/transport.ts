import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type {
  ChatCompletionConfig,
  ChatCompletionResult,
  ChatMessage,
  ChatToolCall,
  ChatToolDefinition,
  IChatTransport,
} from "../../types/chat.types.js";
import { createAgentLogger } from "../../utils/index.js";
import type {
  OpenAIChatConfig,
  OpenAIChatResponse,
  OpenAIErrorResponse,
} from "./types.js";
import { OPENAI_CHAT_URL } from "./types.js";

export class OpenAIChatTransport implements IChatTransport {
  private readonly logger = createAgentLogger("OpenAIChatTransport");

  constructor(private readonly config: OpenAIChatConfig) {}

  async chat(
    messages: ChatMessage[],
    tools?: ChatToolDefinition[],
    configOverride?: Partial<ChatCompletionConfig>,
  ): Promise<ChatCompletionResult> {
    const model = configOverride?.model ?? this.config.model;
    const temperature =
      configOverride?.temperature ?? this.config.temperature ?? 0.4;
    const maxTokens = configOverride?.maxTokens ?? this.config.maxTokens ?? 120;
    const timeoutMs = this.config.timeoutMs ?? 30000;
    const isGpt5 = model.startsWith("gpt-5");
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => this.serializeMessage(m)),
      ...(!isGpt5 && { temperature }),
      ...(isGpt5
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }),
    };

    if (isGpt5) {
      body.reasoning_effort = configOverride?.reasoningEffort ?? "low";
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = configOverride?.toolChoice ?? "auto";
      body.parallel_tool_calls = isGpt5
        ? false
        : (configOverride?.parallelToolCalls ?? true);
    }

    if (configOverride?.user) {
      body.user = configOverride.user;
    }

    this.logger.debug("Chat request body", { body });
    this.logger.info("Chat request", {
      model,
      messageCount: messages.length,
      toolCount: tools?.length ?? 0,
    });

    const startMs = Date.now();
    const response = await this.fetchWithRetry(body, timeoutMs);
    const latencyMs = Date.now() - startMs;

    this.logger.info("Chat response", {
      model: response.model,
      finishReason: response.choices[0]?.finish_reason,
      latencyMs,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new AgentError({
        code: ERROR_CODES.OPENAI_RESPONSE_ERROR,
        message: "No choices in Chat Completions response",
      });
    }

    const toolCalls: ChatToolCall[] | undefined =
      choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));

    return {
      message: {
        role: "assistant",
        content: choice.message.content,
        tool_calls: toolCalls,
      },
      finishReason: choice.finish_reason,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  private serializeMessage(msg: ChatMessage): Record<string, unknown> {
    const serialized: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    };
    if (msg.tool_calls) {
      serialized.tool_calls = msg.tool_calls;
    }
    if (msg.tool_call_id) {
      serialized.tool_call_id = msg.tool_call_id;
    }
    return serialized;
  }

  private async fetchWithRetry(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<OpenAIChatResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.fetchOnce(body, timeoutMs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const status =
          lastError instanceof AgentError &&
          typeof lastError.context.status === "number"
            ? lastError.context.status
            : 0;
        const isRetryable =
          lastError instanceof AgentError && status >= 500 && status < 600;

        if (attempt === 0 && isRetryable) {
          this.logger.warn("Retrying after error", {
            attempt,
            error: lastError.message,
          });
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error("Unexpected retry exhaustion");
  }

  private async fetchOnce(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<OpenAIChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => null)) as OpenAIErrorResponse | null;
        const errorMsg = errorBody?.error?.message ?? `HTTP ${response.status}`;
        const openaiCode = errorBody?.error?.code ?? undefined;
        const openaiType = errorBody?.error?.type;

        if (response.status === 429) {
          const quotaExceeded =
            openaiCode === "insufficient_quota" ||
            /quota|billing/i.test(errorMsg);
          throw new AgentError({
            code: ERROR_CODES.OPENAI_RATE_LIMIT,
            message: `Rate limited: ${errorMsg}`,
            context: {
              status: response.status,
              openaiCode,
              openaiType,
              quotaExceeded,
            },
            recoverable: !quotaExceeded,
            userMessage: quotaExceeded
              ? "Le quota OpenAI est atteint. Le chat IA est temporairement indisponible."
              : "Le service IA est momentanément limité. Réessaie dans un instant.",
          });
        }

        throw new AgentError({
          code: ERROR_CODES.OPENAI_RESPONSE_ERROR,
          message: errorMsg,
          context: { status: response.status },
          recoverable: response.status >= 500,
        });
      }

      return (await response.json()) as OpenAIChatResponse;
    } catch (error) {
      if (error instanceof AgentError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new AgentError({
          code: ERROR_CODES.OPENAI_RESPONSE_ERROR,
          message: `Request timeout after ${timeoutMs}ms`,
          recoverable: true,
        });
      }

      throw AgentError.from(error, ERROR_CODES.OPENAI_RESPONSE_ERROR, {
        phase: "fetch",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createOpenAIChatTransport(
  config: OpenAIChatConfig,
): OpenAIChatTransport {
  return new OpenAIChatTransport(config);
}
