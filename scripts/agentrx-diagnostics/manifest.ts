export interface AgentRxQualitySignal {
  id: "sdk-typecheck" | "starter-typecheck" | "route-wines-harness";
  label: string;
  command: string;
  required: boolean;
}

export interface AgentRxArtifactContract {
  id: "trajectory-ir" | "validation-log" | "diagnostic-report" | "markdown-report";
  fileName: string;
  summaryKey: "trajectoryPath" | "validationLogPath" | "reportPath" | "markdownPath";
}

export const AGENTRX_QUALITY_SIGNALS: readonly AgentRxQualitySignal[] = [
  {
    id: "sdk-typecheck",
    label: "SDK TypeScript contract",
    command: "pnpm typecheck:sdk",
    required: true,
  },
  {
    id: "starter-typecheck",
    label: "VOIP RTC starter TypeScript contract",
    command: "pnpm typecheck:starters",
    required: true,
  },
  {
    id: "route-wines-harness",
    label: "Route-wines harness trajectory",
    command: "pnpm harness:route-wines",
    required: true,
  },
];

export const AGENTRX_ARTIFACTS: readonly AgentRxArtifactContract[] = [
  {
    id: "trajectory-ir",
    fileName: "trajectory-ir.json",
    summaryKey: "trajectoryPath",
  },
  {
    id: "validation-log",
    fileName: "validation-log.json",
    summaryKey: "validationLogPath",
  },
  {
    id: "diagnostic-report",
    fileName: "agentrx-report.json",
    summaryKey: "reportPath",
  },
  {
    id: "markdown-report",
    fileName: "agentrx-report.md",
    summaryKey: "markdownPath",
  },
];
