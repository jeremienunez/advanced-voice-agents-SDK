import type {
  BuilderConfig,
  BuilderSessionResponse,
} from "../../domain/builder.js";
import { fetchWithNetworkError } from "../http.js";

export async function fetchBuilderConfig(
  apiBase: string,
  signal?: AbortSignal,
): Promise<BuilderConfig> {
  const response = await fetchWithNetworkError(`${apiBase}/config`, { signal });
  if (!response.ok) {
    throw new Error(`Builder config failed with ${response.status}`);
  }
  return (await response.json()) as BuilderConfig;
}

export async function fetchBuilderSession(
  apiBase: string,
  signal?: AbortSignal,
): Promise<BuilderSessionResponse | null> {
  const response = await fetchWithNetworkError(`${apiBase}/session`, { signal });
  if (!response.ok) return null;
  return (await response.json()) as BuilderSessionResponse;
}
