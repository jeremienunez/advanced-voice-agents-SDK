import { isGemini31LiveModel } from "./gemini-model.js";

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
