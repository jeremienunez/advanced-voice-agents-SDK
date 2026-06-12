import type {
  LearningSessionInput,
} from "../types/learning/index.js";
import type {
  SessionLearningSignals,
} from "../types/learning-loop/index.js";
import { createDeltas } from "./delta-signals.js";
import { graphEdges, graphNodes } from "./graph-signals.js";
import {
  collectRedactions,
  extractPreferences,
  sanitizeText,
} from "./text-signals.js";

export function extractDefaultSessionLearningSignals(
  input: LearningSessionInput,
): SessionLearningSignals {
  const finalTranscript = input.transcript
    .filter((entry) => entry.isFinal && entry.text.trim())
    .map((entry) => sanitizeText(`${entry.role}: ${entry.text}`));
  const userText = input.transcript
    .filter((entry) => entry.isFinal && entry.role === "user")
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(" ");
  const safeUserText = sanitizeText(userText);
  const redactions = collectRedactions([
    userText,
    ...input.toolCalls.map((call) => call.error ?? ""),
  ].join(" "));
  const failedTools = input.toolCalls.filter((call) => call.status === "failed");
  const missingTools = failedTools
    .filter((call) => /unknown tool|missing|not configured/i.test(call.error ?? ""))
    .map((call) => call.toolName);
  const memories = [
    {
      kind: "summary" as const,
      text: finalTranscript.length
        ? `Session summary: ${finalTranscript.slice(0, 6).join(" | ")}`
        : "Session summary: no final user transcript was captured.",
      data: {
        durationMs: input.summary.durationMs,
        messageCount: input.summary.messageCount,
        toolCallCount: input.summary.toolCallCount,
        endReason: input.summary.endReason,
      },
    },
    ...extractPreferences(safeUserText).map((text) => ({
      kind: "preference" as const,
      text,
      data: { source: "transcript" },
    })),
    ...failedTools.map((call) => ({
      kind: "failed_intent" as const,
      text: `Tool ${call.toolName} failed: ${sanitizeText(call.error ?? "unknown error")}`,
      data: { toolName: call.toolName },
    })),
    ...missingTools.map((toolName) => ({
      kind: "missing_tool" as const,
      text: `Missing or unavailable tool requested: ${toolName}`,
      data: { toolName },
    })),
  ];
  const nodes = graphNodes(input, safeUserText);
  const promptRecommendation = memories.map((memory) => memory.text).join("\n");
  const confidence = finalTranscript.length || failedTools.length ? 0.8 : 0.35;

  return {
    memories,
    graph: {
      nodes,
      edges: graphEdges(input, nodes),
    },
    missingTools,
    promptRecommendation,
    retrievalWeights: {
      temporal: finalTranscript.length ? 0.35 : 0.2,
      graph: nodes.length > 1 ? 0.3 : 0.15,
      knowledge: 0.35,
    },
    deltas: createDeltas({
      confidence,
      memories,
      missingTools,
      promptRecommendation,
      sessionId: input.summary.sessionId,
      userText: safeUserText,
    }),
    redactions,
    confidence,
  };
}
