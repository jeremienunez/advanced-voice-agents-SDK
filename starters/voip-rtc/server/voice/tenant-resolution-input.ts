import type {
  BrowserVoiceSessionRequest,
} from "@voiceagentsdk/core/server/browser";
import type { TenantResolutionInput } from "@voiceagentsdk/core/sdk";

export function tenantResolutionInputFromRequest(
  request: BrowserVoiceSessionRequest,
): TenantResolutionInput {
  return {
    channel: "voice",
    provider: request.provider,
    from: readProviderOption(request, "from"),
    to: readProviderOption(request, "to"),
    callId: request.conversationId ?? request.sessionId,
    accountId: readProviderOption(request, "accountId") ?? request.user.userId,
  };
}

function readProviderOption(
  request: BrowserVoiceSessionRequest,
  key: string,
): string | undefined {
  const value = request.providerOptions?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
