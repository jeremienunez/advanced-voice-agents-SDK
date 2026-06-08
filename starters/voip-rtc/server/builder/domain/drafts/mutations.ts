import {
  createAgentBuildDraftBuilder,
  type AgentBuildDraft,
} from "@voiceagentsdk/core/sdk";
import { asRecord } from "../../utils/record-readers.js";

export function mutateDraft(draft: AgentBuildDraft) {
  const builder = createAgentBuildDraftBuilder(draft.id, draft.identity)
    .registry(draft.toolRegistry)
    .selectTools(draft.selectedTools)
    .metadata(draft.metadata ?? {})
    .status(draft.status);

  if (draft.promptPlan) builder.promptPlan(draft.promptPlan);
  if (draft.knowledgePlan) builder.knowledgePlan(draft.knowledgePlan);
  if (draft.databasePlan) builder.databasePlan(draft.databasePlan);
  if (draft.infraPlan) builder.infraPlan(draft.infraPlan);
  if (draft.toolBuildPlan) builder.toolBuildPlan(draft.toolBuildPlan);
  if (draft.toolValidation) builder.toolValidation(draft.toolValidation);
  if (draft.promptParts.tools) builder.toolPrompt(draft.promptParts.tools);
  if (draft.promptParts.final) builder.finalPrompt(draft.promptParts.final);
  if (draft.compiled) builder.compiled(draft.compiled);

  return builder;
}

export function isAgentDraft(value: unknown): value is AgentBuildDraft {
  const record = asRecord(value);
  return (
    typeof record.id === "string" &&
    typeof record.status === "string" &&
    typeof record.identity === "object" &&
    record.identity !== null
  );
}
