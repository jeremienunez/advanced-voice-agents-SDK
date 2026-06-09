import type { JsonValue } from "../json.js";
import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  TemporalMemoryRecord,
} from "../learning/index.js";
import type { LearningDelta } from "./decisions.js";

export interface LearningMemorySignal {
  kind: TemporalMemoryRecord["kind"];
  text: string;
  data?: JsonValue;
}

export interface SessionLearningSignals {
  memories: LearningMemorySignal[];
  graph: {
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
  };
  missingTools: string[];
  promptRecommendation?: string;
  retrievalWeights?: Record<string, number>;
  deltas: LearningDelta[];
  redactions: string[];
  confidence: number;
}
