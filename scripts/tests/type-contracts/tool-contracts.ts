import type {
  ToolDefinition,
  ToolManifest,
  ToolRuntimeContext,
  VoiceAgentSdkDefinition,
} from "../../../src/sdk/index.js";

type ExecuteIsRequired =
  ToolDefinition extends {
    execute: (
      input: unknown,
      context: ToolRuntimeContext,
    ) => Promise<unknown>;
  }
    ? true
    : false;
type ManifestHasExecute = "execute" extends keyof ToolManifest ? true : false;

const executeIsRequired: ExecuteIsRequired = true;
const manifestHasNoExecute: ManifestHasExecute = false;

const manifest: ToolManifest = {
  name: "create_summary",
  description: "Create a session summary",
  category: "session",
  parameters: { type: "object", properties: {}, required: [] },
  handlerRef: "summary.create",
  sideEffect: "none",
};

const executable: ToolDefinition = {
  ...manifest,
  execute: async () => ({ status: "ok" }),
};

const definition: VoiceAgentSdkDefinition = {
  tenants: [],
  providers: [],
  mediaBridges: [],
  plans: [],
  prompts: [],
  tools: [manifest],
  databases: [],
  stores: [],
  onboarding: [],
  packs: [],
};

void executeIsRequired;
void manifestHasNoExecute;
void executable;
void definition;
