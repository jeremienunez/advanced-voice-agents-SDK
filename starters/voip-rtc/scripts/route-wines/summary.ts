import { asRecord, readArray, readPath } from "./records.js";
import type { JsonRecord } from "./types.js";

export interface HarnessSummaryInput {
  runId: string;
  durationMs: number;
  serverUrl: string | undefined;
  telemetryPath: string;
  summaryPath: string;
  artifactsDir: string;
  serverLogPath: string;
  plannerMaxRetries: number;
  xlsxPath: string;
  config: JsonRecord;
  upload: JsonRecord;
  research: JsonRecord;
  knowledge: JsonRecord;
  documents: unknown[];
  applied: JsonRecord;
  compiledKnowledge: JsonRecord;
  compiledAgent: JsonRecord;
  dbProbe: JsonRecord;
  serverLogAudit: JsonRecord;
  failOnPlannerFallback: boolean;
}

export function buildHarnessSummary(input: HarnessSummaryInput): JsonRecord {
  return {
    runId: input.runId,
    status: "ok",
    durationMs: input.durationMs,
    serverUrl: input.serverUrl,
    telemetryPath: input.telemetryPath,
    summaryPath: input.summaryPath,
    artifactsDir: input.artifactsDir,
    serverLogPath: input.serverLogPath,
    plannerMaxRetries: input.plannerMaxRetries,
    config: {
      availability: readPath(input.config, ["availability"]),
      researchBudget: readPath(input.config, ["defaults", "researchBudget"]),
    },
    xlsx: {
      path: input.xlsxPath,
      kind: readPath(input.upload, ["document", "kind"]),
      rowCount: readPath(input.upload, ["document", "metadata", "rowCount"]),
      sheetNames: readPath(input.upload, [
        "document",
        "metadata",
        "sheetNames",
      ]),
    },
    research: researchSummary(input.research),
    knowledge: {
      strategy: readPath(input.knowledge, [
        "draft",
        "knowledgePlan",
        "strategy",
      ]),
      documentCount: input.documents.length,
      compileResult: readPath(input.compiledKnowledge, ["result"]),
    },
    database: {
      schemaName: readPath(input.applied, ["result", "schemaName"]),
      appliedStatements: readArray(
        readPath(input.applied, ["result", "appliedStatements"]),
      ).length,
      probe: input.dbProbe,
    },
    agent: {
      draftId: readPath(input.compiledAgent, ["artifact", "draftId"]),
      selectedTools: readPath(input.compiledAgent, [
        "artifact",
        "selectedTools",
      ]),
      promptChars: String(
        readPath(input.compiledAgent, ["artifact", "prompt"]) ?? "",
      ).length,
      databaseCount: readArray(
        readPath(input.compiledAgent, [
          "artifact",
          "sdkDefinition",
          "databases",
        ]),
      ).length,
      knowledge: readPath(input.compiledAgent, ["artifact", "knowledge"]),
    },
    telemetry: {
      serverLogAudit: input.serverLogAudit,
      failOnPlannerFallback: input.failOnPlannerFallback,
    },
  };
}

function researchSummary(research: JsonRecord): JsonRecord {
  return {
    status: readPath(research, ["status"]),
    spend: readPath(research, ["research", "spend"]),
    cycles: readPath(research, ["research", "cycles"]),
    checkpoints: readPath(research, ["research", "checkpoints"]),
    documents: readArray(readPath(research, ["documents"])).map((document) => ({
      id: asRecord(document).id,
      kind: asRecord(document).kind,
      sourceCount: readPath(document, ["metadata", "sourceCount"]),
    })),
    stopReason: readPath(research, ["research", "stopReason"]),
  };
}
