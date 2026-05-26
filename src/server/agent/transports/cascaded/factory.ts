import type { CascadedTransportConfig } from "./types.js";
import { AudioChatLLM, TextChatLLM } from "./llm.js";
import { OpenAITTS } from "./tts.js";
import { VadEngine } from "./vad.js";
import { WhisperSTT } from "./stt.js";
import { CascadedRealtimeTransport } from "./transport.js";
import { cascadedLogger } from "./logger.js";

export function createCascadedRealtimeTransport(
  config: CascadedTransportConfig,
): CascadedRealtimeTransport {
  const mode = config.mode ?? "cascade";

  const stt =
    mode === "cascade"
      ? new WhisperSTT(
          config.apiKey,
          config.sttModel ?? "whisper-1",
          config.sttLanguage ?? "fr",
        )
      : null;

  const llm =
    mode === "cascade"
      ? new TextChatLLM(config.apiKey, config.llmModel ?? "gpt-4o", {
          temperature: config.llmTemperature ?? 0.8,
          maxTokens: config.llmMaxTokens ?? 400,
        })
      : new AudioChatLLM(config.apiKey, config.llmModel ?? "gpt-4o", {
          temperature: config.llmTemperature ?? 0.8,
          maxTokens: config.llmMaxTokens ?? 400,
          audioOutput: mode === "moe-full",
        });

  const tts =
    mode !== "moe-full"
      ? new OpenAITTS(config.apiKey, {
          model: config.ttsModel ?? "gpt-4o-mini-tts",
          voice: config.ttsVoice ?? "alloy",
          instructions: config.ttsInstructions,
        })
      : null;

  const vad = new VadEngine({
    silenceDurationMs: config.vadSilenceDurationMs ?? 600,
    speechThresholdRms: config.vadSpeechThresholdRms ?? 300,
    confirmationFrames: config.vadConfirmationFrames ?? 3,
  });

  cascadedLogger.info("Created", {
    mode,
    stt: stt ? "WhisperSTT" : "none",
    llm: mode === "cascade" ? "TextChatLLM" : "AudioChatLLM",
    tts: tts ? "OpenAITTS" : "none",
  });

  return new CascadedRealtimeTransport(config, stt, llm, tts, vad);
}
