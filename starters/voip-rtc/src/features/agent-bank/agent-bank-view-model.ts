import type { AgentBankItem } from "../../domain/builder/types.js";

export type AgentStatusFilter = "all" | "compiled" | "draft" | "ready" | "warning";

export function filterAgents(
  agents: AgentBankItem[],
  query: string,
  filter: AgentStatusFilter,
): AgentBankItem[] {
  const normalized = query.trim().toLowerCase();
  return agents.filter((agent) => {
    const matchesQuery = !normalized ||
      agent.publicAgentName.toLowerCase().includes(normalized) ||
      agent.intent.toLowerCase().includes(normalized) ||
      agent.draftId.toLowerCase().includes(normalized);
    const matchesFilter =
      filter === "all" ||
      (filter === "compiled" && agent.kind === "compiled") ||
      (filter === "draft" && agent.kind === "draft") ||
      (filter === "ready" && agent.canRunRtc) ||
      (filter === "warning" && !agent.canRunRtc);
    return matchesQuery && matchesFilter;
  });
}

export function defaultSelectedAgent(agents: AgentBankItem[]): AgentBankItem | null {
  return agents.find((agent) => agent.active) ?? agents[0] ?? null;
}

export function readinessLabel(agent: AgentBankItem): string {
  if (agent.canRunRtc) return "Ready for RTC";
  if (agent.kind === "draft") return "Draft";
  return "Needs attention";
}
