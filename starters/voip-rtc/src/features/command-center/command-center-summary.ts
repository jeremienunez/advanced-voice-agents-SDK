import type { AgentBankItem } from "../../domain/builder.js";

export function draftCandidate(agents: AgentBankItem[]) {
  return (
    agents.find((agent) => agent.kind === "draft") ??
    agents.find((agent) => !agent.canRunRtc) ??
    null
  );
}

export function summarizeAgent(agent: AgentBankItem | null) {
  if (!agent) {
    return {
      name: "No agent selected",
      intent: "Create or compile an agent to unlock the voice preview.",
      status: "Empty",
      knowledge: "Not configured",
      updated: "Never",
    };
  }

  return {
    name: agent.publicAgentName,
    intent: agent.intent || "No intent recorded.",
    status: agent.active ? "Active" : agent.status,
    knowledge: agent.knowledge?.strategy ?? "Not configured",
    updated: formatDate(agent.updatedAt),
  };
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
