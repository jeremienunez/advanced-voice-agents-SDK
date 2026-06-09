import type { JsonObject } from "../json.js";
import type { EvaluationResult } from "./artifacts.js";
import type { LearningDelta, LearningRunDecision } from "./decisions.js";

export interface LearningReceipt {
  id: string;
  runId: string;
  sourceSessionId: string;
  inputHash: string;
  redactions: string[];
  deltas: LearningDelta[];
  decision: LearningRunDecision;
  evaluation?: EvaluationResult;
  previousArtifactId?: string;
  nextArtifactId?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface LearningAuditEvent {
  type: string;
  runId: string;
  at: string;
  payload?: JsonObject;
}
