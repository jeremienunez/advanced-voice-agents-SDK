import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  LearningSessionInput,
} from "../types/learning/index.js";
import { stableToken } from "./text-signals.js";

export function graphNodes(
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

export function graphEdges(
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
