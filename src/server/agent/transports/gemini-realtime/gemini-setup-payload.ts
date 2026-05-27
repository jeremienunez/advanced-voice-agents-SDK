import type { GeminiRealtimeConfig } from "./types.js";
import { buildThinkingConfig } from "./gemini-thinking.js";

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
