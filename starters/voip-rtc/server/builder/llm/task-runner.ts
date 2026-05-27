import type {
  LlmModelResolverPort,
  LlmProviderId,
  LlmTask,
  LlmTaskResult,
  LlmTaskRunnerPort,
} from "@voiceagentsdk/core/sdk";
import type { BuilderLlmProviderConfig } from "./profiles.js";
import {
  geminiUsage,
  normalizeToolCalls,
  openAiUsage,
  type GeminiResponse,
  type OpenAiCompatibleResponse,
} from "./responses.js";
import { retryDelayMs, shouldRetryError, shouldRetryStatus } from "./retry.js";
import { geminiBody, openAiCompatibleBody } from "./shapes.js";
import { toJsonValue } from "./values.js";

export class BuilderLlmTaskRunner implements LlmTaskRunnerPort {
  constructor(
    private readonly options: {
      providerConfigs: Partial<Record<LlmProviderId, BuilderLlmProviderConfig>>;
      resolver: LlmModelResolverPort;
    },
  ) {}

  async run<TOutput = unknown>(
    task: LlmTask,
  ): Promise<LlmTaskResult<TOutput>> {
    const resolved = await this.options.resolver.resolveModel(task);
    const provider = resolved.profile.provider as LlmProviderId;
    const config = this.options.providerConfigs[provider];
    if (!config?.apiKey) {
      throw new Error(`LLM provider "${provider}" is not configured`);
    }
    if (provider === "gemini") {
      return this.runGemini(task, config, resolved.providerOptions);
    }
    return this.runOpenAiCompatible(task, config, resolved.providerOptions);
  }

  private async runOpenAiCompatible<TOutput>(
    task: LlmTask,
    config: BuilderLlmProviderConfig,
    providerOptions: Parameters<typeof openAiCompatibleBody>[2],
  ): Promise<LlmTaskResult<TOutput>> {
    return retry(config, async () => {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openAiCompatibleBody(task, config, providerOptions)),
      });
      const detail = await response.text();
      if (!response.ok) throw retryableHttpError(config.provider, response, detail);
      const payload = JSON.parse(detail) as OpenAiCompatibleResponse;
      const choice = payload.choices?.[0];
      return {
        taskId: task.id,
        provider: config.provider,
        model: choice?.message?.model ?? payload.model ?? config.defaultModel,
        content: choice?.message?.content?.trim() ?? "",
        reasoningContent: choice?.message?.reasoning_content,
        toolCalls: normalizeToolCalls(choice?.message?.tool_calls),
        usage: openAiUsage(payload.usage),
        raw: toJsonValue(payload),
      };
    });
  }

  private async runGemini<TOutput>(
    task: LlmTask,
    config: BuilderLlmProviderConfig,
    providerOptions: Parameters<typeof geminiBody>[1],
  ): Promise<LlmTaskResult<TOutput>> {
    return retry(config, async () => {
      const model = task.requestedModel?.model || config.defaultModel;
      const url = `${config.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey ?? "",
        },
        body: JSON.stringify(geminiBody(task, providerOptions)),
      });
      const detail = await response.text();
      if (!response.ok) throw retryableHttpError("gemini", response, detail);
      const payload = JSON.parse(detail) as GeminiResponse;
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      return {
        taskId: task.id,
        provider: "gemini",
        model,
        content: parts.map((part) => part.text ?? "").join("").trim(),
        usage: geminiUsage(payload.usageMetadata),
        raw: toJsonValue(payload),
      };
    });
  }
}

async function retry<T>(
  config: BuilderLlmProviderConfig,
  request: () => Promise<T>,
): Promise<T> {
  const maxAttempts = Math.max(1, config.maxRetries + 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (isRetryableHttpError(error, attempt, maxAttempts) ||
        shouldRetryError(error, attempt, maxAttempts)) {
        await Bun.sleep(retryDelayMs(attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`${config.provider} failed after ${maxAttempts} attempts`);
}

function retryableHttpError(
  provider: string,
  response: Response,
  detail: string,
): Error {
  const error = new Error(`${provider} failed: ${response.status} ${detail}`);
  Object.assign(error, { status: response.status });
  return error;
}

function isRetryableHttpError(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  const status = typeof error === "object" && error !== null &&
    "status" in error
    ? Number((error as { status: unknown }).status)
    : NaN;
  return Number.isFinite(status) &&
    shouldRetryStatus(status, attempt, maxAttempts);
}
