import type {
  InfraAction,
  InfraActionResult,
  OnboardingState,
} from "../domain/onboarding/types.js";
import { fetchWithNetworkError, postJson, readError } from "./http.js";

export async function fetchOnboardingState(
  apiBase: string,
  signal?: AbortSignal,
): Promise<OnboardingState> {
  const response = await fetchWithNetworkError(`${apiBase}/onboarding`, {
    signal,
  });
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Onboarding check failed with ${response.status}`);
  }
  return await response.json() as OnboardingState;
}

export function saveOnboardingEnv(
  apiBase: string,
  values: Record<string, string>,
) {
  return postJson<OnboardingState>(`${apiBase}/onboarding/env`, { values });
}

export function runInfraAction(
  apiBase: string,
  action: InfraAction,
  input: Record<string, string>,
) {
  return postInfraAction(`${apiBase}/onboarding/infra/${action}`, input);
}

async function postInfraAction(
  url: string,
  body: unknown,
): Promise<{ infra: InfraActionResult }> {
  const response = await fetchWithNetworkError(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { infra?: InfraActionResult; error?: string };
  if (payload.infra) return { infra: payload.infra };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  throw new Error("Infra action returned an unexpected response");
}
