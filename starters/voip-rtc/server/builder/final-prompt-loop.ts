import type { AgentBuildDraft, ToolName } from "@voiceagentsdk/core/sdk";
import {
  compiledPromptInvariantViolations,
} from "./domain/prompt-invariants.js";
import {
  appendServerOwnedPromptPolicy,
  assertServerOwnedPromptPolicy,
} from "./domain/prompt-policy.js";
import type { BuilderWorkflowDependencies } from "./types.js";

const MAX_FINAL_PROMPT_ATTEMPTS = 3;

export async function composeValidFinalPrompt(input: {
  deps: BuilderWorkflowDependencies;
  draft: AgentBuildDraft;
  selectedTools: ToolName[];
}): Promise<string> {
  let feedback: string[] = [];
  let previousPrompt = "";

  for (let attempt = 1; attempt <= MAX_FINAL_PROMPT_ATTEMPTS; attempt += 1) {
    const generatedPrompt = await input.deps.planner.composeFinalPrompt({
      compositionAttempt: attempt,
      draft: input.draft,
      previousPrompt: previousPrompt || undefined,
      promptQualityFeedback: feedback.length ? feedback : undefined,
      selectedTools: input.selectedTools,
    });
    const prompt = appendServerOwnedPromptPolicy(
      generatedPrompt,
      input.draft,
      input.selectedTools,
    );
    assertServerOwnedPromptPolicy(prompt);
    const violations = compiledPromptInvariantViolations(
      prompt,
      input.draft,
      input.selectedTools,
    );
    if (violations.length === 0) return prompt;
    previousPrompt = generatedPrompt;
    feedback = violations;
  }

  throw new Error(
    `Compiled prompt invariant failed after ${MAX_FINAL_PROMPT_ATTEMPTS} attempts: ${
      feedback.join(", ")
    }`,
  );
}
