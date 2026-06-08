import type { JsonSchema, ToolManifest } from "../../../sdk/types.js";
import { toMcpToolDescriptors } from "../../../sdk/protocols/mcp.js";
import type { McpToolDescriptor } from "../../../sdk/protocols/types.js";
import type { ToolExecutionPolicyEngine } from "../../agent/sessions/tool-execution-policy-engine.js";
import type {
  VoiceSessionTool,
  VoiceSessionToolContext,
} from "../../agent/types/session.types.js";

export interface McpToolCallInput {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolCallContent {
  type: "text";
  text: string;
}

export interface McpToolCallResult {
  content: readonly McpToolCallContent[];
  isError?: boolean;
}

export interface McpToolRegistryAdapterOptions {
  tools: readonly VoiceSessionTool[];
  policy: ToolExecutionPolicyEngine;
  context: VoiceSessionToolContext;
}

export interface McpToolListResult {
  tools: readonly McpToolDescriptor[];
}

export interface McpToolRegistryAdapter {
  listTools(): McpToolListResult;
  callTool(input: McpToolCallInput): Promise<McpToolCallResult>;
}

export function createMcpToolRegistryAdapter(
  options: McpToolRegistryAdapterOptions,
): McpToolRegistryAdapter {
  return {
    listTools() {
      return {
        tools: toMcpToolDescriptors(options.tools.map(runtimeToolToManifest)),
      };
    },

    async callTool(input: McpToolCallInput): Promise<McpToolCallResult> {
      const tool = options.tools.find((candidate) => candidate.name === input.name);
      if (!tool) return errorResult(`Unknown tool: ${input.name}`);
      try {
        const result = await options.policy.execute({
          tool,
          args: input.arguments ?? {},
          context: options.context,
        });
        return { content: [{ type: "text", text: stringifyResult(result) }] };
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    },
  };
}

function runtimeToolToManifest(tool: VoiceSessionTool): ToolManifest {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as JsonSchema,
    sideEffect: tool.policy?.sideEffect,
    executionMode: tool.policy?.executionMode,
    maxCallsPerSession: tool.policy?.maxCallsPerSession,
    timeoutMs: tool.policy?.timeoutMs,
  };
}

function errorResult(message: string): McpToolCallResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function stringifyResult(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result);
}
