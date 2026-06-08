import type {
  AgentBuildDraft,
  ToolManifest,
  ToolRegistryAdapterPort,
  ToolRegistryExecutionInput,
  ToolBuildPlan,
} from "@voiceagentsdk/core/sdk";
import { validateToolBuildPlan } from "../../../server/builder/domain/tooling/validation.js";
import type { RuntimeCompiledAgent } from "../../../server/runtime/compiled-agent.js";
import { runtimeActionTools } from "../../../server/runtime/tools/action-tools.js";
import { runtimeToolHandlerRefs } from "../../../server/runtime/tools/handler-refs.js";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioInjectedRegistryBindsCustomHandler(),
  scenarioSelectedToolWithoutRuntimeBindingIsHidden(),
  scenarioBuilderValidationUsesRegistryHandlerRefs(),
  scenarioRuntimeHandlerRefsIncludeKnowledgeAndActions(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioInjectedRegistryBindsCustomHandler() {
  const calls: ToolRegistryExecutionInput[] = [];
  const registry: ToolRegistryAdapterPort = {
    availableHandlerRefs: () => ["custom.echo"],
    canExecute: (tool) => tool.handlerRef === "custom.echo",
    execute: async (input) => {
      calls.push(input);
      return {
        status: "ok",
        echoed: input.args.message,
        sessionId: input.context?.sessionId,
      };
    },
  };
  const tools = runtimeActionTools(
    runtimeAgent({
      selectedTools: ["custom_echo"],
      tools: [tool("custom_echo", "custom.echo")],
    }),
    registry,
  );

  assert(
    tools.length === 1 && tools[0]?.name === "custom_echo",
    "runtime must expose selected tool bound by injected registry adapter",
  );

  const output = await tools[0].execute(
    { message: "bonjour" },
    { sessionId: "session-registry-port" },
  ) as Record<string, unknown>;

  assert(output.echoed === "bonjour", "registry handler must receive tool args");
  assert(
    output.sessionId === "session-registry-port",
    "registry handler must receive runtime context",
  );
  assert(
    calls[0]?.tool.handlerRef === "custom.echo",
    "registry handler must receive the source tool manifest",
  );

  return "injected-registry-binds-custom-handler";
}

function scenarioSelectedToolWithoutRuntimeBindingIsHidden() {
  const registry: ToolRegistryAdapterPort = {
    availableHandlerRefs: () => ["custom.echo"],
    canExecute: (tool) => tool.handlerRef === "custom.echo",
    execute: async () => ({ status: "ok" }),
  };
  const tools = runtimeActionTools(
    runtimeAgent({
      selectedTools: ["custom_echo"],
      tools: [tool("custom_echo", "missing.echo")],
    }),
    registry,
  );

  assert(
    tools.length === 0,
    "selected tool without registry executable binding must stay hidden",
  );

  return "selected-tool-without-runtime-binding-hidden";
}

function scenarioBuilderValidationUsesRegistryHandlerRefs() {
  const registry: ToolRegistryAdapterPort = {
    availableHandlerRefs: () => ["custom.echo"],
    canExecute: (tool) => tool.handlerRef === "custom.echo",
    execute: async () => ({ status: "ok" }),
  };
  const validation = validateToolBuildPlan(
    draft(),
    toolPlan("custom.echo"),
    new Set(),
    new Set(registry.availableHandlerRefs()),
  );

  assert(
    validation.status === "valid",
    "builder validation must accept handler refs from registry adapter",
  );

  const rejected = validateToolBuildPlan(
    draft(),
    toolPlan("missing.echo"),
    new Set(),
    new Set(registry.availableHandlerRefs()),
  );

  assert(
    rejected.status === "invalid",
    "builder validation must reject handler refs absent from registry adapter",
  );

  return "builder-validation-uses-registry-handler-refs";
}

function scenarioRuntimeHandlerRefsIncludeKnowledgeAndActions() {
  const refs = runtimeToolHandlerRefs();

  assert(
    refs.includes("knowledge.search"),
    "runtime handler refs must include the knowledge tool binding",
  );
  assert(
    refs.includes("summary.create"),
    "runtime handler refs must include action tool bindings",
  );

  return "runtime-handler-refs-include-knowledge-and-actions";
}

function runtimeAgent(input: {
  selectedTools: string[];
  tools: ToolManifest[];
}): RuntimeCompiledAgent {
  return {
    selectedTools: input.selectedTools,
    knowledgeScope: { draftId: "draft-tool-registry-adapter" },
    artifact: {
      draftId: "draft-tool-registry-adapter",
      prompt: "compiled prompt",
      toolRegistry: [],
      selectedTools: input.selectedTools,
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
        tools: input.tools,
        databases: [],
        stores: [],
        onboarding: [],
        packs: [],
      },
    },
  };
}

function tool(name: string, handlerRef: string): ToolManifest {
  return {
    name,
    description: `${name} description`,
    category: "test",
    parameters: { type: "object", properties: {}, required: [] },
    handlerRef,
    sideEffect: "none",
  };
}

function draft(): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id: "draft-tool-registry-adapter",
    status: "draft",
    identity: {
      builderFirstName: "Tool",
      builderLastName: "Registry",
      publicAgentName: "Registry Agent",
      intent: "Validate handler registry adapters",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: ["custom_echo"],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
  };
}

function toolPlan(handlerRef: string): ToolBuildPlan {
  return {
    id: "tools_draft-tool-registry-adapter",
    status: "validated",
    selectedToolNames: ["custom_echo"],
    tools: [{
      name: "custom_echo",
      title: "Custom echo",
      description: "Echo a test message",
      category: "test",
      permissions: [],
      parameters: { type: "object", properties: {}, required: [] },
      sideEffect: "none",
      confirmation: { required: false },
      runtimeBinding: { handlerRef },
      readiness: "ready",
      selected: true,
      reasons: ["test"],
    }],
  };
}
