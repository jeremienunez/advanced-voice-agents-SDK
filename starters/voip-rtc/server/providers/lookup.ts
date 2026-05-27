import type { RuntimeProviderConfig } from "./types.js";

export function runtimeProvider(
  providers: RuntimeProviderConfig[],
  providerId: string,
): RuntimeProviderConfig {
  const provider = providers.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Provider "${providerId}" is not exposed by this starter`);
  }
  return provider;
}
