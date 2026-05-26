import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { probeDatabase } from "./route-wines/database.js";
import { routeWineAgentIdentity } from "./route-wines/default-agent.js";
import {
  maskDatabaseUrl,
  maskEnvAvailability,
  readBoolean,
  readDotEnv,
  readHarnessBudget,
} from "./route-wines/env.js";
import { writeAgentRxArtifacts } from "./route-wines/agentrx.js";
import { getJson, postForm, postJson } from "./route-wines/http.js";
import {
  findFreePort,
  pipeProcessOutput,
  runCommand,
  waitForHealth,
} from "./route-wines/process.js";
import {
  asRecord,
  readArray,
  readPath,
  slugify,
  summarizeStepResult,
} from "./route-wines/records.js";
import { auditServerLog } from "./route-wines/server-log.js";
import { StepRunner } from "./route-wines/step-runner.js";
import { buildHarnessSummary } from "./route-wines/summary.js";
import { Telemetry } from "./route-wines/telemetry.js";
import type { JsonRecord } from "./route-wines/types.js";

const root = new URL("../../../", import.meta.url).pathname;
const starterRoot = new URL("../", import.meta.url).pathname;
const defaultXlsxPath = "/home/jerem/Downloads/routes_vins_france_socle_cartographie.xlsx";

const rootEnv = await readDotEnv(new URL("../../../.env", import.meta.url));
const localEnv = await readDotEnv(new URL("../.env", import.meta.url));
let generatedEnv = await readDotEnv(new URL("../.env.local", import.meta.url));

const env = {
  ...rootEnv,
  ...localEnv,
  ...generatedEnv,
  ...process.env,
};

const runId = `route_wines_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const telemetryDir = join(starterRoot, ".builder-state", "harness-runs", runId);
const artifactsDir = join(telemetryDir, "artifacts");
mkdirSync(telemetryDir, { recursive: true });
mkdirSync(artifactsDir, { recursive: true });

const telemetryPath = join(telemetryDir, "events.jsonl");
const summaryPath = join(telemetryDir, "summary.json");
const serverLogPath = join(telemetryDir, "server.log");
const xlsxPath = env.ROUTE_WINES_XLSX ?? defaultXlsxPath;
const budget = readHarnessBudget(env);
const plannerMaxRetries = Number(
  env.HARNESS_DEEPSEEK_MAX_RETRIES ?? env.DEEPSEEK_MAX_RETRIES,
) || 2;
const failOnPlannerFallback = readBoolean(
  env.HARNESS_FAIL_ON_PLANNER_FALLBACK,
  true,
);

env.DEEPSEEK_MAX_RETRIES = String(plannerMaxRetries);

const telemetry = new Telemetry(runId, telemetryPath);
const steps = new StepRunner(telemetry, artifactsDir);
const runStartedAt = performance.now();
let server: Bun.Subprocess | undefined;
let serverLogDrain: Promise<void> | undefined;
let serverUrl = env.HARNESS_SERVER_URL;

telemetry.event({
  type: "run.start",
  name: "route-wines-first-run",
  data: {
    xlsxPath,
    budget,
    plannerMaxRetries,
    failOnPlannerFallback,
    env: maskEnvAvailability(env),
  },
});

try {
  await step("ensure-db", async () => {
    if (env.DATABASE_URL) return { databaseUrl: maskDatabaseUrl(env.DATABASE_URL) };
    await runCommand("bun", ["run", "scripts/dev-db.ts", "start"], starterRoot, env);
    generatedEnv = await readDotEnv(new URL("../.env.local", import.meta.url));
    if (!generatedEnv.DATABASE_URL) {
      throw new Error("db:start did not write DATABASE_URL");
    }
    env.DATABASE_URL = generatedEnv.DATABASE_URL;
    return { databaseUrl: maskDatabaseUrl(generatedEnv.DATABASE_URL) };
  });

  await step("build-sdk", async () => {
    await runCommand("pnpm", ["build"], root, env);
    return { command: "pnpm build" };
  });

  if (!serverUrl) {
    serverUrl = await step("start-server", async () => {
      const port = await findFreePort();
      server = Bun.spawn(["bun", "server/index.ts"], {
        cwd: starterRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...env,
          VOICE_SERVER_PORT: String(port),
        },
      });
      serverLogDrain = pipeProcessOutput(server, serverLogPath);
      const url = `http://127.0.0.1:${port}`;
      await waitForHealth(url);
      return url;
    });
  }

  const config = await step("config", async () => {
    const payload = await getJson(`${serverUrl}/builder/config`);
    return payload;
  });

  const prompt = await step("prompt-plan", async () => {
    return postJson(`${serverUrl}/builder/prompt-plan`, {
      identity: routeWineAgentIdentity(env),
    });
  });

  const upload = await step("upload-xlsx", async () => {
    if (!existsSync(xlsxPath)) throw new Error(`XLSX fixture not found: ${xlsxPath}`);
    const file = Bun.file(xlsxPath);
    const form = new FormData();
    form.append(
      "file",
      new File([await file.arrayBuffer()], basename(xlsxPath), {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const payload = await postForm(`${serverUrl}/builder/ingest-document`, form);
    return payload;
  });

  const research = await step("autonomous-research", async () => {
    return postJson(`${serverUrl}/builder/run-research`, {
      draftId: readPath(prompt, ["draft", "id"]),
      draft: readPath(prompt, ["draft"]),
      documents: [readPath(upload, ["document"])],
      budget,
    });
  });

  const documents = [
    readPath(upload, ["document"]),
    ...readArray(readPath(research, ["documents"])),
  ];

  const knowledge = await step("knowledge-plan", async () => {
    return postJson(`${serverUrl}/builder/knowledge-plan`, {
      draftId: readPath(prompt, ["draft", "id"]),
      draft: readPath(prompt, ["draft"]),
      documents,
    });
  });

  const database = await step("database-plan", async () => {
    return postJson(`${serverUrl}/builder/database-plan`, {
      draftId: readPath(knowledge, ["draft", "id"]),
      draft: readPath(knowledge, ["draft"]),
      documents,
    });
  });

  const applied = await step("apply-database", async () => {
    return postJson(`${serverUrl}/builder/apply-database`, {
      draftId: readPath(database, ["draft", "id"]),
      draft: readPath(database, ["draft"]),
    });
  });

  const compiledKnowledge = await step("compile-knowledge", async () => {
    return postJson(`${serverUrl}/builder/compile-knowledge`, {
      draftId: readPath(applied, ["draft", "id"]),
      draft: readPath(applied, ["draft"]),
    });
  });

  const compiledAgent = await step("compile-agent", async () => {
    const draft = readPath(compiledKnowledge, ["draft"]) as JsonRecord;
    return postJson(`${serverUrl}/builder/compile-agent`, {
      draftId: draft.id,
      draft,
      selectedTools: draft.selectedTools,
    });
  });

  const dbProbe = await step("db-probe", async () => {
    const storeId = String(readPath(compiledKnowledge, ["result", "storeId"]));
    const schemaName = storeId.includes(":") ? storeId.split(":").at(-1) : undefined;
    if (!schemaName) throw new Error(`Cannot derive schema from storeId: ${storeId}`);
    return probeDatabase(env.DATABASE_URL, schemaName);
  });

  const serverLogAudit = await step("server-log-audit", async () => {
    return auditServerLog(serverLogPath, failOnPlannerFallback);
  });

  const summary = buildHarnessSummary({
    runId,
    durationMs: Math.round(performance.now() - runStartedAt),
    serverUrl,
    telemetryPath,
    summaryPath,
    artifactsDir,
    serverLogPath,
    plannerMaxRetries,
    xlsxPath,
    config,
    upload,
    research,
    knowledge,
    documents,
    applied,
    compiledKnowledge,
    compiledAgent,
    dbProbe,
    serverLogAudit,
    failOnPlannerFallback,
  });
  summary.agentrx = await writeAgentRxArtifacts({
    runId,
    telemetryPath,
    outputDir: telemetryDir,
    summary,
  });

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  telemetry.event({
    type: "run.end",
    name: "route-wines-first-run",
    status: "ok",
    durationMs: Math.round(performance.now() - runStartedAt),
    data: {
      summaryPath,
      telemetryPath,
      draftId: readPath(summary, ["agent", "draftId"]),
    },
  });
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  const summary: JsonRecord = {
    runId,
    status: "error",
    durationMs: Math.round(performance.now() - runStartedAt),
    telemetryPath,
    summaryPath,
    error: error instanceof Error ? error.message : String(error),
  };
  try {
    summary.agentrx = await writeAgentRxArtifacts({
      runId,
      telemetryPath,
      outputDir: telemetryDir,
      summary,
    });
  } catch {
    summary.agentrx = { status: "unavailable" };
  }
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  telemetry.event({
    type: "run.end",
    name: "route-wines-first-run",
    status: "error",
    durationMs: Number(summary.durationMs),
    error: String(summary.error),
    data: { summaryPath, telemetryPath },
  });
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} finally {
  server?.kill();
  await serverLogDrain?.catch(() => undefined);
}

async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  return steps.run(name, run);
}
