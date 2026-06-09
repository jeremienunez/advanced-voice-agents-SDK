import type { JsonObject } from "../json.js";

export interface AgentSkillArtifact {
  id: string;
  title: string;
  description: string;
  scope: "agent" | "tenant" | "global";
  preconditions: string[];
  procedure: string[];
  pitfalls: string[];
  validationChecks: string[];
  sourceSessionIds: string[];
  confidence: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: JsonObject;
}

export interface EvaluationResult {
  status: "passed" | "failed" | "skipped";
  score?: number;
  checks: Array<{
    name: string;
    status: "passed" | "failed" | "skipped";
    message?: string;
  }>;
  metadata?: JsonObject;
}
