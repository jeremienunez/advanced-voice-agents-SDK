import type {
  BuilderSystemConfig,
  BuilderSystemModelSelection,
  BuilderSystemRole,
} from "@voiceagentsdk/core/sdk";
import { asRecord, readString } from "../utils/record-readers.js";

type DefaultSelections = Record<
  "planner" | "researcher" | "verifier",
  BuilderSystemModelSelection
>;

export function normalizeBuilderSystem(
  body: unknown,
  defaults: DefaultSelections,
): BuilderSystemConfig {
  const source = asRecord(asRecord(body).builderSystem);
  const selections = asRecord(source.modelSelections);
  const planner = selectionFor(
    selections,
    "builder.planner",
    defaults.planner,
  );
  return {
    modelSelections: {
      "builder.planner": planner,
      "builder.researcher": selectionFor(
        selections,
        "builder.researcher",
        defaults.researcher,
      ),
      "builder.verifier": selectionFor(
        selections,
        "builder.verifier",
        defaults.verifier,
      ),
      "builder.prompt_composer": selectionFor(
        selections,
        "builder.prompt_composer",
        planner,
      ),
      "builder.database_planner": selectionFor(
        selections,
        "builder.database_planner",
        planner,
      ),
      "builder.tool_planner": selectionFor(
        selections,
        "builder.tool_planner",
        planner,
      ),
    },
  };
}

function selectionFor(
  selections: Record<string, unknown>,
  role: BuilderSystemRole,
  fallback: BuilderSystemModelSelection,
): BuilderSystemModelSelection {
  const source = asRecord(selections[role]);
  return {
    provider: readString(source, "provider") || fallback.provider,
    model: readString(source, "model") || fallback.model,
  };
}
