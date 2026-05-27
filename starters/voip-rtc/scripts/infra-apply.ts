import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
} from "@voiceagentsdk/core/sdk";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PlannedInfraProvisioner } from "../server/builder/adapters/planned-infra-provisioner.js";
import { IntentInfraPlanner } from "../server/builder/domain/infra.js";
import { PlanOnlyInfraIacGenerator } from "../server/builder/domain/infra-iac.js";
import {
  applyKubernetesArtifacts,
  destroyLocalK3s,
  ensureKubectlContext,
  ensureLocalK3s,
  type InfraApplyDriver,
  verifyApply,
} from "./infra-runtime.js";
import { loadStarterEnv } from "./shared/env.js";

type Action = "plan" | "apply" | "status" | "destroy";

const action = (process.argv[2] ?? "plan") as Action;
const env = await loadStarterEnv(import.meta.url);
const starterRoot = resolve(new URL("../", import.meta.url).pathname);
const stateRoot = join(starterRoot, ".builder-state", "iac");
const driver = readOption("driver", env.BUILDER_INFRA_APPLY_DRIVER) ?? "dev-local";
const containerName = env.BUILDER_INFRA_K3S_CONTAINER ?? "voiceagentsdk-k3s";
const k3sImage = env.BUILDER_INFRA_K3S_IMAGE ?? "rancher/k3s:v1.31.5-k3s1";
const k3sPort = env.BUILDER_INFRA_K3S_PORT ?? "16443";
const k3sConfig = { containerName, image: k3sImage, port: k3sPort, stateRoot };

if (!["plan", "apply", "status", "destroy"].includes(action)) {
  fail(`Unknown action "${action}". Use plan, apply, status, or destroy.`);
}
if (driver !== "dev-local" && driver !== "k3s-docker" && driver !== "kubectl") {
  fail(`Unknown driver "${driver}". Use dev-local, k3s-docker, or kubectl.`);
}

if (action === "destroy") {
  await destroyLocalK3s(k3sConfig);
  print({ status: "destroyed", containerName });
  process.exit(0);
}
if (action === "status") {
  await status();
  process.exit(0);
}

const draft = createOnboardingDraft();
const databasePlan = createDatabasePlan(draft.id);
const plan = new IntentInfraPlanner({
  computeTarget: readOption("target", env.BUILDER_INFRA_COMPUTE_TARGET) ?? "local",
  databaseUrl: env.DATABASE_URL,
  defaultVectorBackend: env.BUILDER_VECTOR_BACKEND,
  graphUrl: env.NEO4J_URI ?? env.GRAPH_DATABASE_URL,
  isolation: env.BUILDER_INFRA_ISOLATION ?? "namespace",
  milvusUrl: env.MILVUS_URL ?? env.MILVUS_ADDRESS,
  provisioningMode: "iac_plan",
  redisUrl: env.REDIS_URL,
}).createInfraPlan({ draft, databasePlan });
const validation = new PlannedInfraProvisioner().validate({ draft, plan });
if (!validation.ok) fail(`Invalid infra plan: ${validation.errors.join("; ")}`);

const iac = new PlanOnlyInfraIacGenerator().createBundle({
  ...plan,
  status: validation.status,
  warnings: mergeWarnings(plan.warnings, validation.warnings),
});
const output = writeBundle(draft.id, iac);

if (action === "plan") {
  print({
    status: "planned",
    target: iac.target,
    driver,
    outputDir: output.dir,
    artifacts: output.paths,
    warnings: iac.warnings ?? [],
  });
  process.exit(0);
}

if (driver === "dev-local" || iac.target === "local") {
  if (iac.target !== "local") {
    fail(`dev-local can only apply local plans. Got "${iac.target}".`);
  }
  writeJson(join(output.dir, "apply-result.json"), {
    status: "dev-local",
    driver,
    target: iac.target,
    outputDir: output.dir,
    artifacts: output.paths,
    appliedAt: new Date().toISOString(),
    applied: false,
  });
  writeJson(join(stateRoot, "latest.json"), {
    driver,
    target: iac.target,
    outputDir: output.dir,
  });
  print({
    status: "dev-local",
    driver,
    target: iac.target,
    outputDir: output.dir,
    applied: false,
  });
  process.exit(0);
}

if (iac.target !== "k3s" && iac.target !== "kubernetes") {
  fail(`Apply needs a Kubernetes target. Got "${iac.target}".`);
}

const kubeconfig = driver === "k3s-docker"
  ? await ensureLocalK3s(k3sConfig)
  : await ensureKubectlContext();
await applyKubernetesArtifacts(output.paths, kubeconfig);
await verifyApply(output.namespace, kubeconfig);
writeJson(join(output.dir, "apply-result.json"), {
  status: "applied",
  driver,
  target: iac.target,
  namespace: output.namespace,
  outputDir: output.dir,
  kubeconfig: driver === "k3s-docker" ? kubeconfig : undefined,
  artifacts: output.paths,
  appliedAt: new Date().toISOString(),
});
writeJson(join(stateRoot, "latest.json"), {
  driver,
  namespace: output.namespace,
  outputDir: output.dir,
  kubeconfig: driver === "k3s-docker" ? kubeconfig : undefined,
});
print({
  status: "applied",
  driver,
  target: iac.target,
  namespace: output.namespace,
  outputDir: output.dir,
});

function createOnboardingDraft(): AgentBuildDraft {
  const id = readOption("draft-id", env.BUILDER_INFRA_DRAFT_ID) ?? "onboarding";
  return {
    id: `draft_${safeToken(id)}`,
    status: "draft",
    identity: {
      builderFirstName: "Infra",
      builderLastName: "Onboarding",
      publicAgentName: "Voice Agent SDK Infra",
      intent: env.BUILDER_INFRA_INTENT ??
        "Provision onboarding infrastructure for a reusable voice agent runtime.",
      mustDo: ["Keep generated artifacts actionable by the solution itself."],
      mustNotDo: ["Do not embed secret values in IaC artifacts."],
      llmProvider: "gemini",
      llmModel: "infra-onboarding",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function createDatabasePlan(draftId: string): DatabaseBuildPlan {
  const schemaName = `agent_${safeToken(draftId)}`.slice(0, 60);
  return {
    id: `db_${draftId}`,
    status: "validated",
    databaseProvider: "postgres-pgvector",
    schemaName,
    sqlMigration: "create extension if not exists vector;",
    statements: [],
    tables: [],
    indexes: [],
    vectorization: {
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      dimensions: 1024,
      sourceFields: ["knowledge_chunks.content"],
      metadataFields: ["document_id"],
      retrievalMode: "hybrid",
      chunking: { method: "semantic", targetTokens: 420, overlapTokens: 72 },
      index: { kind: "hnsw", metric: "cosine" },
    },
    kg: { enabled: false, entityTypes: [], relationTypes: [] },
    repositories: { repositories: [], safetyRules: [] },
    reasons: [],
    risks: [],
  };
}

function writeBundle(draftId: string, bundle: ReturnType<PlanOnlyInfraIacGenerator["createBundle"]>) {
  const dir = join(stateRoot, safeToken(draftId), bundle.generatedAt.replace(/[:.]/g, "-"));
  const paths: string[] = [];
  for (const artifact of bundle.artifacts) {
    const path = join(dir, artifact.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, artifact.content);
    paths.push(path);
  }
  writeJson(join(dir, "bundle.json"), bundle);
  return {
    dir,
    namespace: namespaceFromBundle(bundle),
    paths,
  };
}

async function status(): Promise<void> {
  const latestPath = join(stateRoot, "latest.json");
  if (!existsSync(latestPath)) {
    if (driver === "dev-local") {
      print({ status: "dev-local", driver, target: "local", applied: false });
      return;
    }
    fail("No latest infra apply found.");
  }
  const latest = JSON.parse(readFileSync(latestPath, "utf8")) as {
    kubeconfig?: string;
    namespace?: string;
    outputDir: string;
    driver: InfraApplyDriver;
    target?: string;
  };
  if (latest.driver === "dev-local" || latest.target === "local") {
    print({ status: "dev-local", ...latest, applied: false });
    return;
  }
  if (!latest.namespace) fail("Latest Kubernetes apply is missing namespace.");
  await verifyApply(latest.namespace, latest.kubeconfig);
  print({ status: "ok", ...latest });
}

function namespaceFromBundle(bundle: ReturnType<PlanOnlyInfraIacGenerator["createBundle"]>): string {
  const artifact = bundle.artifacts.find((item) => item.path.endsWith("namespace.yaml"));
  const match = artifact?.content.match(/\n  name: ([^\n]+)/);
  return match?.[1]?.trim() ?? "agent-draft-onboarding";
}

function readOption(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    fallback;
}

function mergeWarnings(left?: string[], right?: string[]) {
  const warnings = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return warnings.length ? warnings : undefined;
}

function safeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
