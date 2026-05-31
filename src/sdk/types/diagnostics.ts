export type AgentRxFailureCategory =
  | "Instruction/Plan Adherence Failure"
  | "Invention of New Information"
  | "Invalid Invocation"
  | "Misinterpretation of Tool Output"
  | "Intent-Plan Misalignment"
  | "Underspecified User Intent"
  | "Intent Not Supported"
  | "Guardrails Triggered"
  | "System Failure"
  | "Inconclusive";

export type AgentRxConstraintType =
  | "SCHEMA"
  | "PROTOCOL"
  | "RELATIONAL_POST"
  | "PROVENANCE"
  | "TEMPORAL"
  | "CAPABILITY"
  | "ANY";

export type AgentRxStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type AgentRxViolationSeverity = "low" | "medium" | "high";

export interface AgentRxTrajectoryStep {
  index: number;
  phase: string;
  actor: string;
  action: string;
  status: AgentRxStepStatus;
  summary: string;
  iteration?: number;
  parentStepIndex?: number;
  evidence?: Record<string, unknown>;
}

export interface AgentRxTrajectory {
  id: string;
  instruction: string;
  steps: AgentRxTrajectoryStep[];
  metadata?: Record<string, unknown>;
}

export interface AgentRxConstraint {
  id: string;
  label: string;
  type: AgentRxConstraintType;
  taxonomyTargets: AgentRxFailureCategory[];
  checkHint: string;
  guardHint?: string;
  severity?: AgentRxViolationSeverity;
}

export interface AgentRxViolation {
  stepIndex: number;
  constraintId: string;
  category: AgentRxFailureCategory;
  severity: AgentRxViolationSeverity;
  evidence: string;
  recovered?: boolean;
}

export interface AgentRxValidationLog {
  trajectoryId: string;
  violations: AgentRxViolation[];
  generatedAt: string;
}

export interface AgentRxRepeatedActionSummary {
  phase: string;
  actor: string;
  action: string;
  count: number;
  maxIteration: number;
}

export interface AgentRxIterationSummary {
  repeatedActions: AgentRxRepeatedActionSummary[];
  maxIteration: number;
  maxRecursionDepth: number;
  recursiveCycleDetected: boolean;
  invalidParentStepIndexes: number[];
}

export interface AgentRxDiagnosticReport {
  trajectoryId?: string;
  generatedAt?: string;
  taxonomyVersion?: string;
  status: "healthy" | "watch" | "failed";
  trajectory: AgentRxTrajectoryStep[];
  constraints: AgentRxConstraint[];
  violations: AgentRxViolation[];
  iterationSummary?: AgentRxIterationSummary;
  validationLog?: AgentRxValidationLog;
  criticalFailure?: AgentRxViolation;
  recommendation?: string;
}
