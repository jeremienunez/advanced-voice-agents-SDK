import type {
  AgentBankResponse,
  BuilderSessionResponse,
} from "../../domain/builder.js";
import { postJson, readError } from "../http.js";

export async function fetchAgents(apiBase: string): Promise<AgentBankResponse> {
  const response = await fetch(`${apiBase}/agents`);
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Agent bank failed with ${response.status}`);
  }
  return (await response.json()) as AgentBankResponse;
}

export function activateAgentSession(apiBase: string, draftId: string) {
  return postJson<BuilderSessionResponse>(`${apiBase}/session`, { draftId });
}

export function rollbackAgentVersion(apiBase: string, draftId: string) {
  return postJson<{
    status: string;
    draftId: string;
    version: number;
    reason: string;
  }>(`${apiBase}/agents/rollback`, { draftId });
}
