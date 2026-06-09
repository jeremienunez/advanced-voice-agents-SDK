import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  LearningSessionInput,
} from "../types/learning/index.js";
import type {
  LearningDelta,
  LearningMemorySignal,
  SessionLearningSignals,
} from "../types/learning-loop/index.js";

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

function extractPreferences(text: string): string[] {
  if (!text) return [];
  const preferences: string[] = [];
  const patterns = [
    /\b(?:i prefer|i like|je prefere|j'aime)\s+([^.!?]{3,120})/gi,
    /\b(?:call me|appelle-moi)\s+([^.!?]{2,80})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      preferences.push(`User preference: ${sanitizeText(match[1] ?? "")}`);
    }
  }
  return preferences.slice(0, 5);
}

function graphNodes(
  input: LearningSessionInput,
  userText: string,
): GraphMemoryNode[] {
  const draftId = input.draftId ?? input.agentId ?? "unknown";
  const nodes: GraphMemoryNode[] = [
    {
      id: `agent:${draftId}`,
      type: "agent",
      label: draftId,
      properties: input.tenantId ? { tenantId: input.tenantId } : {},
    },
    {
      id: `session:${input.summary.sessionId}`,
      type: "session",
      label: input.summary.sessionId,
      properties: {
        durationMs: input.summary.durationMs,
        endReason: input.summary.endReason,
      },
    },
  ];
  if (input.userId) {
    nodes.push({
      id: `user:${input.tenantId ?? "local"}:${input.userId}`,
      type: "user",
      label: input.userId,
      properties: input.tenantId ? { tenantId: input.tenantId } : {},
    });
  }
  for (const entity of extractEntities(userText)) {
    nodes.push({
      id: `entity:${stableToken(entity)}`,
      type: "entity",
      label: entity,
      properties: { source: "session_transcript" },
    });
  }
  return uniqueNodes(nodes);
}

function graphEdges(
  input: LearningSessionInput,
  nodes: GraphMemoryNode[],
): GraphMemoryEdge[] {
  const draftId = input.draftId ?? input.agentId ?? "unknown";
  const sessionId = input.summary.sessionId;
  const edges: GraphMemoryEdge[] = [
    {
      id: `edge:agent:${draftId}:learned_from:${sessionId}`,
      from: `agent:${draftId}`,
      to: `session:${sessionId}`,
      type: "learned_from",
      properties: { at: new Date(input.summary.endedAt).toISOString() },
    },
  ];
  if (input.userId) {
    edges.push({
      id: `edge:user:${input.tenantId ?? "local"}:${input.userId}:participated:${sessionId}`,
      from: `user:${input.tenantId ?? "local"}:${input.userId}`,
      to: `session:${sessionId}`,
      type: "participated_in",
    });
  }
  for (const node of nodes.filter((item) => item.type === "entity")) {
    edges.push({
      id: `edge:session:${sessionId}:mentions:${node.id}`,
      from: `session:${sessionId}`,
      to: node.id,
      type: "mentions",
    });
  }
  return edges;
}

function extractEntities(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b[A-Z][A-Za-z0-9&._-]{2,}(?:\s+[A-Z][A-Za-z0-9&._-]{2,}){0,2}\b/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function uniqueNodes(nodes: GraphMemoryNode[]): GraphMemoryNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}

function stableToken(value: string): string {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function createDeltas(input: {
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

function collectRedactions(value: string): string[] {
  const checks: Array<[string, RegExp]> = [
    ["openai-key", /sk-[A-Za-z0-9_-]{12,}/],
    ["bearer-token", /Bearer\s+[A-Za-z0-9._-]+/i],
    ["named-secret", /(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/i],
  ];
  return checks
    .filter(([, pattern]) => pattern.test(value))
    .map(([name]) => name);
}

function sanitizeText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}
