import type { AgentRxFailureCategory } from "../types.js";

export const AGENTRX_TAXONOMY_VERSION = "agentrx-2026-02";

export const AGENTRX_FAILURE_CATEGORIES = [
  "Instruction/Plan Adherence Failure",
  "Invention of New Information",
  "Invalid Invocation",
  "Misinterpretation of Tool Output",
  "Intent-Plan Misalignment",
  "Underspecified User Intent",
  "Intent Not Supported",
  "Guardrails Triggered",
  "System Failure",
  "Inconclusive",
] as const satisfies readonly AgentRxFailureCategory[];

export function isAgentRxFailureCategory(
  value: unknown,
): value is AgentRxFailureCategory {
  return typeof value === "string" &&
    AGENTRX_FAILURE_CATEGORIES.includes(value as AgentRxFailureCategory);
}
