import type {
  TenantResolutionInput,
  TenantResolutionResult,
  TenantResolverPort,
} from "@voiceagentsdk/core/sdk";
import type { StarterSdk } from "./types.js";

export function createDevTenantResolver(
  sdk: StarterSdk,
): TenantResolverPort {
  return {
    resolveTenant(input: TenantResolutionInput): TenantResolutionResult {
      const tenant = sdk.getTenant("local") ?? sdk.definition.tenants[0];
      const tenantId = tenant?.id ?? "local";
      const providerId = requestedProviderId(sdk, input) ??
        tenant?.defaultProviderId ??
        sdk.definition.providers[0]?.id ??
        "gemini";
      const mediaBridgeId = tenant?.defaultMediaBridgeId ??
        sdk.definition.mediaBridges[0]?.id ??
        "browser";
      const planId = sdk.definition.plans[0]?.id ?? "dev";
      const userId = input.accountId ?? "demo";

      return {
        tenantId,
        providerId,
        mediaBridgeId,
        planId,
        userId,
        promptVariables: {
          tenantId,
          providerId,
          planId,
          userId,
        },
        metadata: { source: "dev-tenant-resolver" },
      };
    },
  };
}

function requestedProviderId(
  sdk: StarterSdk,
  input: TenantResolutionInput,
): string | undefined {
  return input.provider && sdk.getProvider(input.provider)
    ? input.provider
    : undefined;
}
