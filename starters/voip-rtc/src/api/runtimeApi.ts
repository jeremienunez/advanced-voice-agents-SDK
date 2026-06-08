import type { RuntimeConfig } from "../domain/runtime/config.js";
import { fetchWithNetworkError } from "./http.js";

export async function fetchRuntimeConfig(
  configUrl: string,
  signal?: AbortSignal,
): Promise<RuntimeConfig> {
  const response = await fetchWithNetworkError(configUrl, { signal });
  if (!response.ok) {
    throw new Error(`Config request failed with ${response.status}`);
  }
  return (await response.json()) as RuntimeConfig;
}
