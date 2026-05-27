import { createBrowserVoiceService } from "@voiceagentsdk/core/server/browser";
import { createSessionEndedLearningHook } from "./learning-hook.js";
import { createVoiceMediaConfig } from "./media-config.js";
import { createVoiceSessionFactory } from "./session-factory.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createStarterVoiceService(
  options: StarterVoiceServiceOptions,
) {
  return createBrowserVoiceService({
    createSession: createVoiceSessionFactory(options),
    media: createVoiceMediaConfig(options),
    onSessionEnded: createSessionEndedLearningHook(options),
  });
}
