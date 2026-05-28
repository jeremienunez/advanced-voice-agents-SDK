import { compileArtifact } from "./domain/prompt.js";
import { assertCompiledPromptInvariants } from "./domain/prompt-invariants.js";
import {
  appendServerOwnedPromptPolicy,
  assertServerOwnedPromptPolicy,
} from "./domain/prompt-policy.js";
import { mutateDraft } from "./domain/drafts.js";
import { createToolBuildPlan } from "./domain/tooling/contracts.js";
import { toolInstructionsFromPlan } from "./domain/tooling/compile.js";
import { validatedToolPlan, validateToolBuildPlan } from "./domain/tooling/validation.js";
import { normalizeSelectedTools } from "./request/selected-tools.js";
import { resolveDraft, saveDraft } from "./state/draft-store.js";
import { setActiveDraft } from "./state/session-store.js";
import type { BuilderWorkflowDependencies } from "./types.js";

export async function compileAgentWithServerPolicy(
  body: unknown,
  deps: BuilderWorkflowDependencies,
) {
  const draft = resolveDraft(body);
  const selectedTools = normalizeSelectedTools(body, draft);
  const plannedTools = createToolBuildPlan(draft, selectedTools);
  const validation = validateToolBuildPlan(
    draft,
    plannedTools,
    new Set(deps.availableSecretNames),
    new Set(deps.availableToolHandlerRefs),
  );
  const toolPlan = validatedToolPlan(plannedTools, validation);
  const toolPrompt = toolInstructionsFromPlan(toolPlan);
  const draftWithTools = mutateDraft(draft)
    .selectTools(selectedTools)
    .toolBuildPlan(toolPlan)
    .toolValidation(validation)
    .toolPrompt(toolPrompt)
    .build();

  if (validation.status === "invalid") {
    saveDraft(draftWithTools);
    throw new Error(`Tool validation failed: ${validationErrors(validation)}`);
  }

  const generatedPrompt = await deps.planner.composeFinalPrompt({
    draft: draftWithTools,
    selectedTools,
  });
  const prompt = appendServerOwnedPromptPolicy(
    generatedPrompt,
    draftWithTools,
    selectedTools,
  );
  assertServerOwnedPromptPolicy(prompt);
  assertCompiledPromptInvariants(prompt, draftWithTools, selectedTools);
  const artifact = compileArtifact(draftWithTools, selectedTools, prompt, toolPlan);
  const nextDraft = mutateDraft(draftWithTools)
    .finalPrompt(prompt)
    .compiled(artifact)
    .build();
  saveDraft(nextDraft);
  setActiveDraft(nextDraft.id);
  return { draft: nextDraft, artifact };
}

function validationErrors(
  validation: ReturnType<typeof validateToolBuildPlan>,
): string {
  return validation.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => `${issue.toolName ?? "tool"}: ${issue.message}`)
    .join("; ");
}
