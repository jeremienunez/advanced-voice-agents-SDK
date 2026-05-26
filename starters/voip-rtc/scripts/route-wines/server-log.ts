import { existsSync, readFileSync } from "node:fs";
import type { JsonRecord } from "./types.js";

export function auditServerLog(
  path: string,
  shouldFailOnPlannerFallback: boolean,
): JsonRecord {
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = text.split(/\r?\n/).filter(Boolean);
  const plannerFallbackLines = lines.filter(
    (line) =>
      line.includes("DeepSeek planner failed") ||
      line.includes("Fallback local utilise"),
  );
  const errorLines = lines.filter((line) =>
    /\b(error|exception|unhandled|failed)\b/i.test(line),
  );
  const result = {
    path,
    lineCount: lines.length,
    plannerFallbackCount: plannerFallbackLines.length,
    errorLineCount: errorLines.length,
    plannerFallbackSamples: plannerFallbackLines.slice(0, 5),
    errorSamples: errorLines.slice(0, 5),
  };

  if (shouldFailOnPlannerFallback && plannerFallbackLines.length > 0) {
    throw new Error(
      `Planner fallback detected in server log: ${plannerFallbackLines[0]}`,
    );
  }

  return result;
}
