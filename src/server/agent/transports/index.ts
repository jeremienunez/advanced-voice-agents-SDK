export {
  OPENAI_BYTES_PER_SAMPLE,
  OPENAI_CHANNELS,
  OPENAI_SAMPLE_RATE,
  AudioBuffer,
  calculateAudioDurationMs,
  createAudioChunk,
  decodeAudioFromOpenAI,
  encodeAudioForOpenAI,
} from "./openai-audio.js";

export {
  OpenAIRealtimeTransport,
  buildOpenAIRealtimeSessionConfig,
  createOpenAIRealtimeTransport,
  type OpenAIEventHandlers,
  type OpenAIRealtimeConfig,
} from "./openai-realtime.js";

export {
  GeminiRealtimeTransport,
  createGeminiRealtimeTransport,
  type GeminiRealtimeConfig,
} from "./gemini-realtime.js";

export {
  GrokRealtimeTransport,
  createGrokRealtimeTransport,
  type GrokRealtimeConfig,
} from "./grok-realtime.js";

export {
  TwilioVoiceTransport,
  createTwilioVoiceTransport,
  type TwilioVoiceConfig,
  type TwilioVoiceEventHandlers,
} from "./twilio-voice.js";

export {
  TwilioSmsTransport,
  createTwilioSmsTransport,
  type TwilioSmsConfig,
} from "./twilio-sms.js";

export {
  OpenAIChatTransport,
  createOpenAIChatTransport,
  type OpenAIChatConfig,
} from "./openai-chat.js";

export {
  CascadedRealtimeTransport,
  createCascadedRealtimeTransport,
} from "./cascaded/index.js";
export type { CascadedMode, CascadedTransportConfig } from "./cascaded/types.js";
