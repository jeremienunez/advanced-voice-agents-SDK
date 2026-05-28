import {
  createAgentBuilder,
  createToolBuilder,
} from "../../../src/sdk/index.js";
import { compileToolDefinitions } from "../server/builder/domain/tooling/compile.js";
import type { RuntimeCompiledAgent } from "../server/runtime/compiled-agent.js";
import { runtimeActionTools } from "../server/runtime/tools/action-tools.js";
import { assert } from "./shared/assertions.js";

const results = [
  scenarioBuildCompilesSerializableManifests(),
  scenarioAgentBuilderStoresSerializableManifests(),
  await scenarioRuntimeBindsManifestsToExecutableTools(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioBuildCompilesSerializableManifests() {
  const [tool] = compileToolDefinitions({
    id: "plan-tool-contracts",
    status: "validated",
    selectedToolNames: ["create_summary"],
    tools: [{
      name: "create_summary",
      title: "Create summary",
      description: "Create a session summary",
      category: "session",
      permissions: ["session:write"],
      parameters: { type: "object", properties: {}, required: [] },
      sideEffect: "none",
      confirmation: { required: false },
      runtimeBinding: { handlerRef: "summary.create" },
      readiness: "ready",
      selected: true,
      reasons: ["selected for contract test"],
    }],
  });

  assert(tool !== undefined, "selected ready tool must compile");
  assert(!("execute" in tool), "compiled tool manifest must not carry execute");
  assert(
    JSON.stringify(tool).includes("handlerRef"),
    "compiled tool manifest must remain serializable with a handlerRef",
  );

  return "build-compiles-serializable-tool-manifest";
}

function scenarioAgentBuilderStoresSerializableManifests() {
  const executable = createToolBuilder("lookup_order")
    .describe("Look up an order")
    .parameters({
      type: "object",
      properties: { orderId: { type: "string" } },
      required: ["orderId"],
    })
    .handler(async () => ({ status: "ok" }))
    .build();

  const definition = createAgentBuilder().tool(executable).build();
  const [tool] = definition.tools;

  assert(tool !== undefined, "agent builder must keep the tool manifest");
  assert(
    !("execute" in tool),
    "agent builder must strip executable handlers from SDK definitions",
  );
  assert(
    !JSON.stringify(definition).includes("execute"),
    "serialized SDK definition must not contain executable handlers",
  );

  return "agent-builder-stores-serializable-tool-manifest";
}

async function scenarioRuntimeBindsManifestsToExecutableTools() {
  const [tool] = runtimeActionTools(runtimeAgent());

  assert(tool !== undefined, "runtime must expose selected bound tool");
  assert(
    typeof tool.execute === "function",
    "runtime tool must expose an executable handler",
  );

  const output = await tool.execute(
    {
      summary: "Session closed cleanly",
      keyFacts: ["tool contracts split"],
      nextActions: [],
    },
    { sessionId: "session-tool-contracts" },
  );

  const record = output as Record<string, unknown>;

  assert(
    record.status === "created",
    "runtime executable handler must process the tool call",
  );

  return "runtime-binds-manifest-to-executable-tool";
}

function runtimeAgent(): RuntimeCompiledAgent {
  return {
    selectedTools: ["create_summary"],
    knowledgeScope: { draftId: "draft-tool-contracts" },
    artifact: {
      draftId: "draft-tool-contracts",
      prompt: "compiled prompt",
      toolRegistry: [],
      selectedTools: ["create_summary"],
      knowledge: {
        strategy: "hybrid",
        documentCount: 0,
        chunkCount: 0,
        status: "planned",
      },
      createdAt: new Date(0).toISOString(),
      sdkDefinition: {
        tenants: [],
        providers: [],
        mediaBridges: [],
        plans: [],
        prompts: [],
        tools: [{
          name: "create_summary",
          description: "Create a session summary",
          category: "session",
          parameters: { type: "object", properties: {}, required: [] },
          handlerRef: "summary.create",
          sideEffect: "none",
        }],
        databases: [],
        stores: [],
        onboarding: [],
        packs: [],
      },
    },
  };
}
