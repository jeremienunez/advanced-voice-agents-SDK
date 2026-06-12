import type {
  LearningDelta,
  LearningMemorySignal,
} from "../types/learning-loop/index.js";
import { stableToken } from "./text-signals.js";

export function createDeltas(input: {
  confidence: number;
  memories: LearningMemorySignal[];
  missingTools: string[];
  promptRecommendation: string;
  sessionId: string;
  userText: string;
}): LearningDelta[] {
  const memoryDeltas = input.memories.map((memory) =>
    delta("memory", memory.kind, memory.text, input, {
      data: memory.data ?? null,
      kind: memory.kind,
      text: memory.text,
    })
  );
  const toolDeltas = input.missingTools.map((tool) =>
    delta("tool", `Missing tool ${tool}`, `Add or bind runtime tool ${tool}.`, input, { tool })
  );
  const promptDelta = input.promptRecommendation
    ? [delta("prompt", "Prompt learning summary", input.promptRecommendation, input, {
        prompt: input.promptRecommendation,
      })]
    : [];
  const skillDelta = proceduralGuidance(input.userText)
    ? [delta("skill", "Procedural session guidance", input.userText, input, {
        procedure: splitProcedure(input.userText),
      })]
    : [];
  return [...memoryDeltas, ...toolDeltas, ...promptDelta, ...skillDelta];
}

function delta(
  kind: LearningDelta["kind"],
  title: string,
  summary: string,
  input: { confidence: number; sessionId: string },
  payload: LearningDelta["payload"],
): LearningDelta {
  return {
    id: `delta_${kind}_${stableToken(`${input.sessionId}_${title}`).slice(0, 56)}`,
    kind,
    scope: kind === "memory" ? "user" : "agent",
    title,
    summary,
    confidence: input.confidence,
    payload,
    sourceSessionIds: [input.sessionId],
    promotionState: "candidate",
  };
}

function proceduralGuidance(text: string): boolean {
  return /\b(always|first|step|when)\b/i.test(text);
}

function splitProcedure(text: string): string[] {
  return text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
}
