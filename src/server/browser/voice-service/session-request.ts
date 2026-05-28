import type { ClientVoiceMessage } from "../../../sdk/types/browser-voice.js";
import { randomSessionId } from "./session-id.js";
import type {
  BrowserVoiceServiceConfig,
  BrowserVoiceSessionRequest,
  BrowserVoiceUserContext,
} from "./types.js";

export function createBrowserSessionRequest(
  config: BrowserVoiceServiceConfig,
  user: BrowserVoiceUserContext,
  message: Extract<ClientVoiceMessage, { type: "session.start" }>,
): BrowserVoiceSessionRequest {
  return {
    sessionId: config.createSessionId?.() ?? randomSessionId(),
    provider: message.provider,
    agent: message.agent,
    model: message.model,
    voice: message.voice,
    providerOptions: message.providerOptions,
    conversationId: message.conversationId,
    user,
  };
}
