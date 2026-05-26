import type { GeminiRealtimeModel } from "../../types/gemini.types.js";
import type { GeminiRealtimeConfig } from "./types.js";

export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";

export function normalizeGeminiModel(
  model?: GeminiRealtimeModel,
): string {
  const rawModel = model ?? DEFAULT_GEMINI_LIVE_MODEL;
  return rawModel.startsWith("models/") ? rawModel : `models/${rawModel}`;
}

export function buildGeminiSetupPayload(
  config: GeminiRealtimeConfig,
  model: string,
): Record<string, unknown> {
  return {
    setup: {
      model,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voice ?? "Orus",
            },
          },
        },
        thinkingConfig: buildThinkingConfig(model),
        ...(config.temperature != null && {
          temperature: config.temperature,
        }),
      },
      ...(config.instructions && {
        systemInstruction: {
          parts: [{ text: config.instructions }],
        },
      }),
      ...(config.tools?.length && {
        tools: [
          {
            functionDeclarations: config.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: cleanSchemaForGemini(tool.parameters),
            })),
          },
        ],
      }),
    },
  };
}

export function buildGeminiCreateResponseMessage(
  model: string,
): Record<string, unknown> {
  return isGemini31LiveModel(model)
    ? { realtimeInput: { text: "." } }
    : {
        clientContent: {
          turns: [
            {
              role: "user" as const,
              parts: [{ text: "." }],
            },
          ],
          turnComplete: true,
        },
      };
}

export function buildGeminiSystemMessage(content: string): Record<string, unknown> {
  return {
    clientContent: {
      turns: [
        {
          role: "user" as const,
          parts: [{ text: `[System] ${content}` }],
        },
      ],
      turnComplete: false,
    },
  };
}

export function buildThinkingConfig(model: string): Record<string, unknown> {
  if (isGemini31LiveModel(model)) {
    return { thinkingLevel: "minimal" };
  }
  return { thinkingBudget: 0 };
}

export function isGemini31LiveModel(model: string): boolean {
  return model.includes("gemini-3.1-flash-live-preview");
}

function cleanSchemaForGemini(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties" || key === "$schema") continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = cleanSchemaForGemini(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
