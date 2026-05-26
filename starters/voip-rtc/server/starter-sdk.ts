import { compileVoiceAgentSdk } from "@voiceagentsdk/core/sdk";
import type { RuntimeProviderConfig, StarterProviderId } from "./provider-catalog.js";

export function createStarterSdk(
  providerCatalog: RuntimeProviderConfig[],
  defaultProviderId: StarterProviderId,
  browserSampleRate: number,
) {
  return compileVoiceAgentSdk({
    tenants: [
      {
        id: "local",
        displayName: "Local RTC Lab",
        defaultProviderId,
        defaultMediaBridgeId: "browser",
      },
    ],
    providers: providerCatalog.map((provider) => ({
      id: provider.id,
      displayName: provider.label,
      kind: provider.kind,
      model: provider.defaultModel,
      voice: provider.defaultVoice,
      inputSampleRate: provider.inputSampleRate,
      outputSampleRate: provider.outputSampleRate,
      apiKey: { name: provider.requiredEnv[0] },
    })),
    mediaBridges: [
      {
        id: "browser",
        kind: "browser-websocket",
        providerId: defaultProviderId,
        inputEncoding: "pcm16",
        outputEncoding: "pcm16",
        sampleRate: browserSampleRate,
      },
    ],
    plans: [],
    prompts: [
      {
        id: "rtc-lab-system",
        channels: ["voice"],
        priority: 1,
        body:
          "You are a concise realtime voice agent used to validate a reusable VOIP starter.\n" +
          "Presence: calm, focused, warm, and controlled; make the conversation feel intentional rather than generic.\n" +
          "Voice style: short spoken turns, natural pacing, one question at a time.\n" +
          "Operating rules: clarify unclear audio, do not invent facts or tool results, and state uncertainty when context is missing.\n" +
          "Action rule: confirm before any external action, handoff, booking, write operation, or follow-up.",
      },
    ],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  });
}
