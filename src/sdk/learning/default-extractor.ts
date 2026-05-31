import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  LearningSessionInput,
  SessionLearningSignals,
} from "../types.js";

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
    ...extractPreferences(userText).map((text) => ({
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
  const nodes = graphNodes(input, userText);

  return {
    memories,
    graph: {
      nodes,
      edges: graphEdges(input, nodes),
    },
    missingTools,
    promptRecommendation: memories.map((memory) => memory.text).join("\n"),
    retrievalWeights: {
      temporal: finalTranscript.length ? 0.35 : 0.2,
      graph: nodes.length > 1 ? 0.3 : 0.15,
      knowledge: 0.35,
    },
    confidence: finalTranscript.length || failedTools.length ? 0.8 : 0.35,
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

function sanitizeText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}
