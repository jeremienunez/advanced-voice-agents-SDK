import { createAgentBuildDraftBuilder } from "@voiceagentsdk/core/sdk";
import { assert } from "../shared/assertions.js";

const results = [
  scenarioDraftIdentityExcludesSystemModels(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioDraftIdentityExcludesSystemModels(): string {
  const draft = createAgentBuildDraftBuilder("draft-system-roles", {
    builderFirstName: "System",
    builderLastName: "Tester",
    publicAgentName: "Clean Agent",
    intent: "Help users without leaking builder internals",
    mustDo: ["stay focused"],
    mustNotDo: ["invent facts"],
  })
    .builderSystem({
      modelSelections: {
        "builder.planner": { provider: "gemini", model: "gemini-planner" },
        "builder.researcher": { provider: "deepseek", model: "deepseek-research" },
        "builder.verifier": { provider: "kimi", model: "kimi-verifier" },
      },
    })
    .build();

  const identity = draft.identity as unknown as Record<string, unknown>;
  assert(!("llmProvider" in identity), "draft identity must not carry llmProvider");
  assert(!("llmModel" in identity), "draft identity must not carry llmModel");
  assert(
    draft.builderSystem?.modelSelections["builder.planner"]?.model ===
      "gemini-planner",
    "builder system roles must carry planner model selection",
  );

  return "draft-identity-excludes-system-models";
}
