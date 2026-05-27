import type {
  AgentBuildDraft,
  ToolName,
} from "@voiceagentsdk/core/sdk";
import { asRecord } from "../utils.js";

export function normalizeSelectedTools(
  body: unknown,
  draft: AgentBuildDraft,
): ToolName[] {
  const source = asRecord(body);
  if (!Array.isArray(source.selectedTools)) return draft.selectedTools;
  const available = new Set(draft.toolRegistry.map((item) => item.name));
  return source.selectedTools
    .filter((item): item is string => typeof item === "string")
    .filter((item) => available.has(item));
}
