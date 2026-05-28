import type { ToolManifest } from "@voiceagentsdk/core/sdk";
import type { RuntimeCompiledAgent } from "../server/runtime/compiled-agent.js";
import { runtimeActionTools } from "../server/runtime/tools/action-tools.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioRuntimeExposesOnlySelectedTools(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRuntimeExposesOnlySelectedTools() {
  const tools = runtimeActionTools(runtimeAgent({
    selectedTools: ["create_summary"],
    tools: [
      tool("create_summary", "summary.create"),
      tool("schedule_follow_up", "task.schedule"),
    ],
  }));
  const names = tools.map((item) => item.name);

  assert(
    names.includes("create_summary"),
    "selected action tool must remain available",
  );
  assert(
    !names.includes("schedule_follow_up"),
    "unselected action tool must not be exposed even if artifact contains it",
  );

  return "runtime-tools-selected-only";
}

function runtimeAgent(input: {
  selectedTools: string[];
  tools: ToolManifest[];
}): RuntimeCompiledAgent {
  return {
    selectedTools: input.selectedTools,
    knowledgeScope: { draftId: "draft-runtime-auth" },
    artifact: {
      draftId: "draft-runtime-auth",
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
