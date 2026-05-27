import type { ProviderDefinition } from "@voiceagentsdk/core/sdk";
import type { StarterSdk } from "./types.js";

export function resolveProviderDefinition(
  sdk: StarterSdk,
  requestedProviderId: string | undefined,
  tenantId: string,
): ProviderDefinition | undefined {
  if (requestedProviderId) return sdk.getProvider(requestedProviderId);
  return sdk.providerForTenant(tenantId);
}
