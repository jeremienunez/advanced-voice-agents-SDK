import type { RealtimeSessionUpdate } from "../../types/transport.types.js";
import type { OpenAISessionConfig } from "../../types/openai.types.js";
import type { OpenAIRealtimeConfig } from "./types.js";

export function buildOpenAIRealtimeSessionConfig(
  config: OpenAIRealtimeConfig,
): Record<string, unknown> {
  const session: Record<string, unknown> = {
    type: "realtime",
    output_modalities: ["audio"],
    audio: {
      input: {
        format:
          config.inputFormat === "g711_ulaw"
            ? { type: "audio/pcmu" }
            : { type: "audio/pcm", rate: 24000 },
        noise_reduction: config.noiseReduction
          ? { type: config.noiseReduction }
          : undefined,
        turn_detection: config.turnDetection ?? {
          type: "semantic_vad",
          eagerness: "auto",
          create_response: true,
          interrupt_response: true,
        },
        transcription: {
          model: "gpt-4o-transcribe",
          language: "fr",
        },
      },
      output: {
        format: { type: "audio/pcm", rate: 24000 },
        voice: config.voice ?? "marin",
        speed: config.speed ?? 0.9,
      },
    },
    max_output_tokens: 4096,
  };
  if (config.instructions) session.instructions = config.instructions;
  if (config.tools?.length) session.tools = config.tools;

  const model = config.model ?? "gpt-realtime-1.5";
  if (
    model === "gpt-realtime-2" &&
    config.reasoningEffort &&
    config.reasoningEffort !== "default"
  ) {
    session.reasoning = { effort: config.reasoningEffort };
  }
  return session;
}

export function buildOpenAIRealtimeSessionUpdate(
  config: RealtimeSessionUpdate | Partial<OpenAISessionConfig>,
): Record<string, unknown> {
  const raw = config as Record<string, unknown>;
  const sessionConfig: Record<string, unknown> = { type: "realtime" };

  if (raw.turnDetection) {
    sessionConfig.audio = {
      input: { turn_detection: raw.turnDetection },
    };
  }
  if (raw.instructions) sessionConfig.instructions = raw.instructions;
  if (raw.tools) sessionConfig.tools = raw.tools;
  if (raw.voice) {
    sessionConfig.audio = {
      ...((sessionConfig.audio as Record<string, unknown>) ?? {}),
      output: { voice: raw.voice },
    };
  }
  if (raw.audio) sessionConfig.audio = raw.audio;
  if (raw.output_modalities) {
    sessionConfig.output_modalities = raw.output_modalities;
  }

  return sessionConfig;
}
