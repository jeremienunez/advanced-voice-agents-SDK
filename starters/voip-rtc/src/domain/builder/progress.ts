import type { AgentBuildDraft } from "./types.js";

export interface BusyState {
  title: string;
  detail: string;
  steps: string[];
}

export function getBusyState(busy: string): BusyState {
  switch (busy) {
    case "prompt":
      return {
        title: "Builder LLM is planning the agent",
        detail:
          "The builder is extracting missing questions, voice direction, and prompt part 1.",
        steps: ["Intent", "Guardrails", "Voice", "Prompt"],
      };
    case "prompt-confirm":
      return {
        title: "Prompt blueprint is being validated",
        detail:
          "User clarifications are merged into prompt part 1 before the knowledge stage.",
        steps: ["Answers", "Assumptions", "Prompt", "Save"],
      };
    case "documents":
      return {
        title: "Documents are being parsed",
        detail:
          "The starter normalizes uploaded files before asking for a knowledge strategy.",
        steps: ["Read", "Classify", "Validate"],
      };
    case "knowledge":
      return {
        title: "Knowledge strategy is being designed",
        detail:
          "The configured builder model is choosing between vector, lexical, hybrid, RAPTOR, and KG paths.",
        steps: ["Metadata", "Chunking", "Indexes", "KG"],
      };
    case "research":
      return {
        title: "Autonomous knowledge growth is running",
        detail:
          "The knowledge agent spends its bounded search budget on cited sources, then distills new RAG/KG material.",
        steps: ["Budget", "Search", "Sources", "Distill"],
      };
    case "compile-knowledge":
      return {
        title: "Knowledge store compile is running",
        detail:
          "Voyage embeddings and Postgres pgvector are prepared for the validated plan.",
        steps: ["Chunks", "Embeddings", "FTS", "HNSW"],
      };
    case "database-plan":
      return {
        title: "Database strategy is being planned",
        detail:
          "The configured builder model is proposing isolated SQL, vectorization, indexes, and safe repositories.",
        steps: ["Schema", "SQL", "Vector", "Repos"],
      };
    case "database-apply":
      return {
        title: "Knowledge database is being created",
        detail:
          "The server validates the SQL allowlist, opens a transaction, and provisions the agent schema.",
        steps: ["Validate", "Transaction", "Schema", "Indexes"],
      };
    case "compile-agent":
      return {
        title: "Agent spec is being compiled",
        detail:
          "The final prompt, selected tools, and RTC-ready SDK artifact are assembled.",
        steps: ["Tools", "Prompt", "SDK spec", "RTC"],
      };
    default:
      return {
        title: "Work is running",
        detail: "The builder is processing the current step.",
        steps: ["Validate", "Process", "Save"],
      };
  }
}

export function resolveBuilderStep(
  draft: AgentBuildDraft | null,
  documentCount: number,
): number {
  if (!draft) return 0;
  if (draft.compiled) return 5;
  if (draft.databasePlan?.status === "applied") return 4;
  if (draft.knowledgePlan) return 3;
  if (documentCount > 0) return 2;
  if (draft.promptPlan) return 1;
  return 0;
}

export function resolveUnlockedBuilderStep(
  draft: AgentBuildDraft | null,
  documentCount: number,
): number {
  if (!draft) return 0;
  if (draft.compiled) return 5;
  if (draft.databasePlan?.status === "applied") return 5;
  if (draft.knowledgePlan) return 4;
  if (documentCount > 0) return 3;
  if (draft.promptPlan) return 2;
  return 0;
}

export async function keepLoaderVisible(
  startedAt: number,
  minMs = 750,
): Promise<void> {
  const remaining = minMs - (performance.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
