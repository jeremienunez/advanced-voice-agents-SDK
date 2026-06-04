import type { JsonValue } from "../../../sdk/types/json.js";
import type { VoiceSessionTool } from "../../agent/types/index.js";
import {
  createMcpToolRegistryAdapter,
  type McpToolRegistryAdapterOptions,
} from "./tool-registry-adapter.js";

export type McpJsonRpcId = string | number | null;
export type McpJsonRpcRequestId = string | number;

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: McpJsonRpcRequestId;
  method: string;
  params?: unknown;
}

export interface McpJsonRpcError {
  code: number;
  message: string;
  data?: JsonValue;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: McpJsonRpcId;
  result?: unknown;
  error?: McpJsonRpcError;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpJsonRpcToolAdapterOptions
  extends McpToolRegistryAdapterOptions {
  protocolVersion?: string;
  serverInfo?: McpServerInfo;
}

export interface McpJsonRpcToolAdapter {
  handle(input: unknown): Promise<McpJsonRpcResponse | null>;
}

type McpRequestMethod = "initialize" | "ping" | "tools/list" | "tools/call";

const DEFAULT_PROTOCOL_VERSION = "2025-11-25";

export function createMcpJsonRpcToolAdapter(
  options: McpJsonRpcToolAdapterOptions,
): McpJsonRpcToolAdapter {
  const registry = createMcpToolRegistryAdapter(options);
  return {
    async handle(input: unknown): Promise<McpJsonRpcResponse | null> {
      const request = readRequest(input);
      if (!request) return errorResponse(null, -32600, "Invalid Request");
      if (request.id === undefined) {
        return request.method === "notifications/initialized"
          ? null
          : errorResponse(null, -32600, "Invalid Request");
      }
      const method = normalizeMethod(request.method);
      if (!method) {
        return errorResponse(request.id, -32601, "Method not found");
      }
      try {
        return successResponse(
          request.id,
          await dispatchMethod(options, registry, method, request.params),
        );
      } catch (error) {
        return errorResponse(
          request.id,
          -32602,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}

async function dispatchMethod(
  options: McpJsonRpcToolAdapterOptions,
  registry: ReturnType<typeof createMcpToolRegistryAdapter>,
  method: McpRequestMethod,
  params: unknown,
): Promise<unknown> {
  if (method === "initialize") return initializeResult(options);
  if (method === "ping") return {};
  if (method === "tools/list") return registry.listTools();
  const body = asRecord(params);
  const name = stringValue(body.name);
  if (!name) throw new Error("tools/call params.name is required");
  if (!hasTool(options.tools, name)) throw new Error(`Unknown tool: ${name}`);
  return registry.callTool({
    name,
    arguments: asArguments(body.arguments),
  });
}

function initializeResult(options: McpJsonRpcToolAdapterOptions) {
  return {
    protocolVersion: options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
    },
    serverInfo: options.serverInfo ?? {
      name: "@voiceagentsdk/core",
      version: "0.1.0-alpha.1",
    },
  };
}

function readRequest(input: unknown): McpJsonRpcRequest | null {
  const request = asRecord(input);
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return null;
  }
  const id = request.id;
  if (
    id !== undefined &&
    typeof id !== "string" &&
    typeof id !== "number"
  ) {
    return null;
  }
  return {
    jsonrpc: "2.0",
    id: id as McpJsonRpcRequestId | undefined,
    method: request.method,
    params: request.params,
  };
}

function normalizeMethod(method: string): McpRequestMethod | null {
  if (method === "initialize") return "initialize";
  if (method === "ping") return "ping";
  if (method === "tools/list") return "tools/list";
  if (method === "tools/call") return "tools/call";
  if (method === "notifications/initialized") return null;
  return null;
}

function hasTool(tools: readonly VoiceSessionTool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

function asArguments(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function successResponse(id: McpJsonRpcId, result: unknown): McpJsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(
  id: McpJsonRpcId,
  code: number,
  message: string,
): McpJsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
