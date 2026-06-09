import type { AgentChannel, ProviderId, ToolName } from "../core/index.js";
import type { MemoryRecord } from "./memory.js";
import type { TenantResolutionResult } from "./tenant.js";

export interface RuntimePromptCompileInput {
  channel: AgentChannel;
  providerId: ProviderId;
  agentId?: string;
  tenant: TenantResolutionResult;
  toolNames: readonly ToolName[];
  memories?: readonly MemoryRecord[];
}

export interface PromptCompilerPort {
  compilePrompt(
    input: RuntimePromptCompileInput,
  ): string | Promise<string>;
}
