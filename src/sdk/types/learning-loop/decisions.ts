import type { JsonObject } from "../json.js";

export interface LearningRunDecision {
  action:
    | "none"
    | "write_memory"
    | "candidate"
    | "apply"
    | "pending_approval"
    | "reject";
  reason: string;
  requiresApproval?: boolean;
  confidence?: number;
  metadata?: JsonObject;
}

export type LearningDeltaKind = "memory" | "prompt" | "skill" | "tool" | "infra";
export type LearningPromotionScope = "session" | "user" | "agent" | "tenant" | "global";
export type LearningPromotionState =
  | "candidate"
  | "evaluated"
  | "approved"
  | "active"
  | "rolled_back"
  | "rejected"
  | "expired";

export interface LearningDelta {
  id: string;
  kind: LearningDeltaKind;
  scope: LearningPromotionScope;
  title: string;
  summary: string;
  confidence: number;
  payload: JsonObject;
  sourceSessionIds: string[];
  promotionState: LearningPromotionState;
}
