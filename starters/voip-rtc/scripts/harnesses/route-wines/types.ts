export type JsonRecord = Record<string, unknown>;

export interface TelemetryEvent {
  runId: string;
  type: "run.start" | "step.start" | "step.end" | "run.end" | "metric";
  name: string;
  timestamp: string;
  durationMs?: number;
  status?: "ok" | "error";
  data?: JsonRecord;
  error?: string;
}

export interface HarnessBudget {
  maxCycles: number;
  maxQueriesPerCycle: number;
  maxSources: number;
  maxEstimatedTokens: number;
  maxEstimatedCostUsd: number;
}
