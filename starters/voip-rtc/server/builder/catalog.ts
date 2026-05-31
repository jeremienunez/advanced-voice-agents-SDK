import type {
  KnowledgeResearchBudget,
  ToolRegistryItem,
} from "@voiceagentsdk/core/sdk";

export const strategyLabels = [
  "vector",
  "lexical",
  "hybrid",
  "raptor",
  "kg",
  "hybrid_kg",
] as const;

export const defaultToolRegistry: ToolRegistryItem[] = [
  {
    name: "search_knowledge",
    title: "Search knowledge",
    description:
      "Search validated chunks from the compiled RAG store before answering.",
    category: "knowledge",
    permissions: ["knowledge:read"],
    requiresKnowledge: true,
    selectedByDefault: true,
  },
  {
    name: "create_summary",
    title: "Create summary",
    description: "Produce a structured post-call or post-chat summary.",
    category: "productivity",
    permissions: ["summary:create"],
    selectedByDefault: true,
  },
  {
    name: "handoff_to_human",
    title: "Handoff to human",
    description:
      "Escalate when confidence, permissions, or user intent require a human operator.",
    category: "routing",
    permissions: ["handoff:create"],
  },
  {
    name: "schedule_follow_up",
    title: "Schedule follow-up",
    description: "Create a follow-up task after explicit user confirmation.",
    category: "workflow",
    permissions: ["task:create"],
  },
  {
    name: "emit_structured_note",
    title: "Emit structured note",
    description:
      "Write a typed event for downstream CRM, analytics, or automation systems.",
    category: "integration",
    permissions: ["event:write"],
  },
];

export function defaultResearchBudget(): KnowledgeResearchBudget {
  return {
    maxCycles: 5,
    maxQueriesPerCycle: 4,
    maxSources: 10,
    maxEstimatedTokens: 12_000,
    maxEstimatedCostUsd: 0.25,
  };
}

export function researchBudgetFromEnv(
  env: Record<string, string | undefined>,
): KnowledgeResearchBudget {
  const defaults = defaultResearchBudget();
  return {
    maxCycles: readEnvNumber(
      env.BUILDER_RESEARCH_MAX_CYCLES,
      defaults.maxCycles,
    ),
    maxQueriesPerCycle: readEnvNumber(
      env.BUILDER_RESEARCH_MAX_QUERIES_PER_CYCLE,
      defaults.maxQueriesPerCycle,
    ),
    maxSources: readEnvNumber(
      env.BUILDER_RESEARCH_MAX_SOURCES,
      defaults.maxSources,
    ),
    maxEstimatedTokens: readEnvNumber(
      env.BUILDER_RESEARCH_MAX_TOKENS,
      defaults.maxEstimatedTokens,
    ),
    maxEstimatedCostUsd: readEnvNumber(
      env.BUILDER_RESEARCH_MAX_COST_USD,
      defaults.maxEstimatedCostUsd,
    ),
  };
}

function readEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
