import type {
  AgentBuildDraft,
  AgentInfraPlan,
  KnowledgeBackendPlan,
  KnowledgeBuildPlan,
} from "@voiceagentsdk/core/sdk";
import { IntentInfraPlanner } from "../server/builder/domain/infra.js";
import { PlanOnlyInfraIacGenerator } from "../server/builder/domain/infra-iac.js";
import { validateInfraProvisionInput } from "../server/builder/domain/infra-provisioning.js";
import { assert } from "./shared/assertions.js";

const results = [
  scenarioMilvusAndGraphStayStarterOwnedUntilPromoted(),
  scenarioValidationRejectsExternalBackendWithoutBoundary(),
  scenarioIacExportsAdapterBoundaries(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioMilvusAndGraphStayStarterOwnedUntilPromoted(): string {
  const plan = vectorGraphPlan();
  const milvus = requiredBackend(plan, "milvus-vector");
  const graph = requiredBackend(plan, "graph-index");

  assert(
    milvus.adapterBoundary?.owner === "starter",
    "Milvus must stay owned by the starter until a reusable SDK adapter package exists",
  );
  assert(
    milvus.adapterBoundary.binding === "planned_only",
    "Milvus must be marked planned_only while no runtime adapter is implemented",
  );
  assert(
    milvus.adapterBoundary.promotion === "candidate_sdk_package",
    "Milvus must document the SDK package promotion path",
  );
  assert(
    graph.adapterBoundary?.owner === "starter",
    "Graph backend must stay owned by the starter until a reusable SDK adapter package exists",
  );
  assert(
    graph.adapterBoundary.binding === "planned_only",
    "Graph backend must be marked planned_only while no runtime graph adapter is implemented",
  );
  assert(
    graph.adapterBoundary.promotionCriteria.some((item) => item.includes("contract tests")),
    "Graph promotion must require contract tests",
  );

  return "milvus-graph-starter-owned-boundaries";
}

function scenarioValidationRejectsExternalBackendWithoutBoundary(): string {
  const plan = vectorGraphPlan();
  const invalidPlan = {
    ...plan,
    knowledgeBackends: plan.knowledgeBackends.map((backend) =>
      backend.id === "milvus-vector"
        ? ({ ...backend, adapterBoundary: undefined })
        : backend
    ),
  };
  const validation = validateInfraProvisionInput({ draft: draft(), plan: invalidPlan });

  assert(!validation.ok, "infra validation must fail without adapter boundary");
  assert(
    validation.errors.some((error) =>
      error.includes('Backend "milvus-vector" must declare adapter ownership boundary')
    ),
    `missing boundary error must name Milvus backend: ${validation.errors.join("; ")}`,
  );

  return "validation-rejects-missing-adapter-boundary";
}

function scenarioIacExportsAdapterBoundaries(): string {
  const bundle = new PlanOnlyInfraIacGenerator().createBundle(vectorGraphPlan());
  const variables = bundle.artifacts.find((artifact) =>
    artifact.path === "k3s/agent.auto.tfvars.json"
  );
  assert(variables, "k3s OpenTofu variables artifact must exist");

  const content = JSON.parse(variables.content) as {
    knowledge_backends: Array<{
      id: string;
      adapter_boundary?: { owner?: string; binding?: string; promotion?: string };
    }>;
  };
  const milvus = content.knowledge_backends.find((backend) => backend.id === "milvus-vector");
  const graph = content.knowledge_backends.find((backend) => backend.id === "graph-index");

  assert(
    milvus?.adapter_boundary?.binding === "planned_only",
    "Milvus boundary must be exported to OpenTofu variables",
  );
  assert(
    graph?.adapter_boundary?.owner === "starter",
    "Graph boundary must be exported to OpenTofu variables",
  );

  return "iac-exports-adapter-boundaries";
}

function vectorGraphPlan(): AgentInfraPlan {
  return new IntentInfraPlanner({
    computeTarget: "k3s",
    databaseUrl: "postgres://local/test",
    defaultVectorBackend: "milvus",
    graphUrl: "neo4j://graph:7687",
    milvusUrl: "http://milvus:19530",
    provisioningMode: "iac_plan",
  }).createInfraPlan({
    draft: draft(),
    knowledgePlan: knowledgePlan(),
  });
}

function requiredBackend(plan: AgentInfraPlan, id: string): KnowledgeBackendPlan {
  const backend = plan.knowledgeBackends.find((item) => item.id === id);
  assert(backend, `missing backend: ${id}`);
  return backend;
}

function draft(): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id: "draft_adapter_boundaries",
    status: "draft",
    identity: {
      builderFirstName: "Adapter",
      builderLastName: "Boundary",
      publicAgentName: "Adapter Boundary Agent",
      intent: "Use Milvus vector retrieval and graph relationship traversal",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
  };
}

function knowledgePlan(): KnowledgeBuildPlan {
  return {
    strategy: "hybrid_kg",
    alternativeStrategies: [],
    documents: [],
    chunking: {
      method: "semantic",
      targetTokens: 420,
      overlapTokens: 72,
    },
    indexes: [],
    kg: {
      enabled: true,
      entityTypes: ["entity"],
      relationTypes: ["related_to"],
    },
    reasons: [],
    validationRequired: false,
  };
}
