import type {
  RuntimeProviderConfig,
  StarterProviderId,
} from "./types.js";

export function resolveDefaultProviderId(
  providers: RuntimeProviderConfig[],
): StarterProviderId {
  const preferred = Bun.env.DEFAULT_REALTIME_PROVIDER as
    | StarterProviderId
    | undefined;
  if (
    preferred &&
    providers.some((provider) => provider.id === preferred && provider.enabled)
  ) {
    return preferred;
  }

  return (
    providers.find((provider) => provider.id === "gemini" && provider.enabled)
      ?.id ??
    providers.find((provider) => provider.enabled)?.id ??
    "gemini"
  );
}
