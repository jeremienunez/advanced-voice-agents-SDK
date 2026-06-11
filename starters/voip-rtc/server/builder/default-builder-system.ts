import type {
  BuilderSystemConfig,
  BuilderSystemModelSelection,
} from "@voiceagentsdk/core/sdk";
import type { BuilderWorkflowDependencies } from "./types.js";

type DefaultBuilderSystemSelections = Record<
  "planner" | "researcher" | "verifier",
  BuilderSystemModelSelection
>;

export function builderSystemDefaults(
  deps: BuilderWorkflowDependencies,
): DefaultBuilderSystemSelections {
  return {
    planner: {
      provider: deps.promptProvider,
      model: deps.promptModel,
    },
    researcher: {
      provider: deps.researchProvider,
      model: deps.researchModel,
    },
    verifier: {
      provider: deps.knowledgeVerificationProvider,
      model: deps.knowledgeVerificationModel,
    },
  };
}

export function defaultPromptBuilderSystem(
  selection: BuilderSystemModelSelection,
): BuilderSystemConfig {
  return {
    modelSelections: {
      "builder.planner": selection,
      "builder.prompt_composer": selection,
      "builder.database_planner": selection,
      "builder.tool_planner": selection,
    },
  };
}
