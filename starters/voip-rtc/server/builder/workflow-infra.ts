import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
  KnowledgeBuildPlan,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import type { BuilderWorkflowDependencies } from "./types.js";

export async function createValidatedInfraPlan(input: {
  databasePlan: DatabaseBuildPlan;
  deps: BuilderWorkflowDependencies;
  documents: KnowledgeDocument[];
  draft: AgentBuildDraft;
  knowledgePlan?: KnowledgeBuildPlan;
}) {
  const plan = await input.deps.infraPlanner.createInfraPlan({
    draft: input.draft,
    documents: input.documents,
    knowledgePlan: input.knowledgePlan,
    databasePlan: input.databasePlan,
  });
  const validation = input.deps.infraProvisioner.validate({
    draft: input.draft,
    plan,
  });
  const validatedPlan = {
    ...plan,
    status: validation.status,
    warnings: mergeWarnings(plan.warnings, validation.warnings),
  };
  const iac = input.deps.infraIacGenerator.createBundle(validatedPlan);
  return {
    plan: {
      ...validatedPlan,
      iac,
    },
    validation,
  };
}

function mergeWarnings(
  left: string[] | undefined,
  right: string[] | undefined,
): string[] | undefined {
  const warnings = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return warnings.length ? warnings : undefined;
}
