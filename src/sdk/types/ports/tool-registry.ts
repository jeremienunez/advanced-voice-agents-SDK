import type { ToolManifest } from "../core/index.js";

export interface ToolRegistryRuntimeContext {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  providerId?: string;
}

export interface ToolRegistryExecutionInput {
  tool: ToolManifest;
  args: Record<string, unknown>;
  context?: ToolRegistryRuntimeContext;
}

export interface ToolRegistryAdapterPort {
  availableHandlerRefs(): readonly string[];
  canExecute(tool: ToolManifest): boolean;
  execute(input: ToolRegistryExecutionInput): Promise<unknown>;
}
