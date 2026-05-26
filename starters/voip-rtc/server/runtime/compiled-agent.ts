import type {
  AgentBuildDraft,
  CompiledAgentArtifact,
  KnowledgeSearchScope,
} from "@voiceagentsdk/core/sdk";
import { appliedAgentSchema } from "../infra/postgres/sql.js";

export interface RuntimeCompiledAgent {
  artifact: CompiledAgentArtifact;
  knowledgeScope: KnowledgeSearchScope;
  selectedTools: string[];
}

export function runtimeAgentFromDraft(
  draft: AgentBuildDraft | undefined,
): RuntimeCompiledAgent | undefined {
  if (!draft?.compiled) return undefined;
  return {
    artifact: draft.compiled,
    selectedTools: draft.compiled.selectedTools,
    knowledgeScope: {
      draftId: draft.id,
      schemaName: appliedAgentSchema(draft.databasePlan),
      storeId: draft.compiled.knowledge?.storeId,
    },
  };
}
