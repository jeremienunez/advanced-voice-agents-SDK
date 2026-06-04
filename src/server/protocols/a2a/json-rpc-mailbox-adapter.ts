import type { JsonValue } from "../../../sdk/types/json.js";
import {
  A2AProtocolError,
  isTerminalA2ATaskState,
  taskNotCancelable,
  taskNotFound,
} from "./json-rpc-mailbox-errors.js";
import {
  readA2ARole,
  readParts,
} from "./json-rpc-mailbox-message.js";
import {
  asJsonObject,
  asRecord,
  readMailboxStatuses,
  readPositiveInteger,
  readStringArray,
} from "./json-rpc-mailbox-readers.js";
import type { A2AMailboxTaskRouter } from "./task-router.js";

export type A2AJsonRpcId = string | number | null;

export interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id?: A2AJsonRpcId;
  method: string;
  params?: unknown;
}

export interface A2AJsonRpcError {
  code: number;
  message: string;
  data?: JsonValue;
}

export interface A2AJsonRpcResponse {
  jsonrpc: "2.0";
  id: A2AJsonRpcId;
  result?: unknown;
  error?: A2AJsonRpcError;
}

export interface A2AJsonRpcMailboxContext {
  tenantId: string;
  sourceAgentId?: string;
  targetAgentId?: string;
}

export interface A2AJsonRpcMailboxAdapterOptions {
  router: A2AMailboxTaskRouter;
}

export interface A2AJsonRpcMailboxAdapter {
  handle(
    input: unknown,
    context?: A2AJsonRpcMailboxContext,
  ): Promise<A2AJsonRpcResponse>;
}

type A2AMailboxJsonRpcMethod =
  | "message/send"
  | "tasks/get"
  | "tasks/list"
  | "tasks/cancel";

export function createA2AJsonRpcMailboxAdapter(
  options: A2AJsonRpcMailboxAdapterOptions,
): A2AJsonRpcMailboxAdapter {
  return {
    async handle(
      input: unknown,
      context?: A2AJsonRpcMailboxContext,
    ): Promise<A2AJsonRpcResponse> {
      const request = readRequest(input);
      if (!request) return errorResponse(null, -32600, "Invalid Request");
      const method = normalizeMethod(request.method);
      if (!method) return errorResponse(request.id ?? null, -32601, "Method not found");
      try {
        return successResponse(
          request.id ?? null,
          await dispatchMethod(options.router, method, request.params, context),
        );
      } catch (error) {
        if (error instanceof A2AProtocolError) {
          return errorResponse(request.id ?? null, error.code, error.message, error.data);
        }
        return errorResponse(
          request.id ?? null,
          -32602,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}

async function dispatchMethod(
  router: A2AMailboxTaskRouter,
  method: A2AMailboxJsonRpcMethod,
  params: unknown,
  context: A2AJsonRpcMailboxContext | undefined,
): Promise<unknown> {
  if (method === "message/send") {
    const body = asRecord(params);
    const message = asRecord(body.message);
    const task = await router.sendMessage({
      tenantId: readTenantId(body, context),
      sourceAgentId: readSourceAgentId(body, message, context),
      targetAgentId: readTargetAgentId(body, message, context),
      targetUserId: readString(body, message, "targetUserId"),
      contextId: readString(body, message, "contextId"),
      taskId: readString(body, message, "taskId"),
      referenceTaskIds: readStringArray(body.referenceTaskIds) ??
        readStringArray(message.referenceTaskIds),
      subject: readString(body, message, "subject"),
      message: {
        role: readA2ARole(message.role),
        messageId: readString(body, message, "messageId"),
        metadata: asJsonObject(message.metadata),
        parts: readParts(message.parts),
      },
    });
    return { task };
  }
  if (method === "tasks/get") {
    const body = asRecord(params);
    const task = await router.getTask({
      tenantId: readTenantId(body, context),
      taskId: requireTaskId(body),
      targetAgentId: readString(body, {}, "targetAgentId"),
      sourceAgentId: readString(body, {}, "sourceAgentId"),
    });
    if (!task) throw taskNotFound(requireTaskId(body));
    return task;
  }
  if (method === "tasks/list") {
    const body = asRecord(params);
    return router.listTasks({
      tenantId: readTenantId(body, context),
      targetAgentId: readString(body, {}, "targetAgentId"),
      sourceAgentId: readString(body, {}, "sourceAgentId"),
      contextId: readString(body, {}, "contextId"),
      status: readMailboxStatuses(body.status),
      limit: readPositiveInteger(body.limit ?? body.pageSize),
    });
  }
  const body = asRecord(params);
  const taskId = requireTaskId(body);
  const current = await router.getTask({
    tenantId: readTenantId(body, context),
    taskId,
    targetAgentId: readString(body, {}, "targetAgentId"),
    sourceAgentId: readString(body, {}, "sourceAgentId"),
  });
  if (!current) throw taskNotFound(taskId);
  if (isTerminalA2ATaskState(current.status.state)) {
    throw taskNotCancelable(taskId);
  }
  return router.ackTask({
    tenantId: readTenantId(body, context),
    taskId,
    targetAgentId: readString(body, {}, "targetAgentId"),
    sourceAgentId: readString(body, {}, "sourceAgentId"),
    status: "canceled",
  });
}

function readRequest(input: unknown): A2AJsonRpcRequest | null {
  const request = asRecord(input);
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return null;
  }
  const id = request.id;
  if (
    id !== undefined &&
    id !== null &&
    typeof id !== "string" &&
    typeof id !== "number"
  ) {
    return null;
  }
  return {
    jsonrpc: "2.0",
    id: id as A2AJsonRpcId | undefined,
    method: request.method,
    params: request.params,
  };
}

function normalizeMethod(method: string): A2AMailboxJsonRpcMethod | null {
  if (method === "message/send" || method === "SendMessage") return "message/send";
  if (method === "tasks/get" || method === "GetTask") return "tasks/get";
  if (method === "tasks/list" || method === "ListTasks") return "tasks/list";
  if (method === "tasks/cancel" || method === "CancelTask") return "tasks/cancel";
  return null;
}

function readTenantId(
  body: Record<string, unknown>,
  context: A2AJsonRpcMailboxContext | undefined,
): string {
  const tenantId = readString(body, {}, "tenantId") || context?.tenantId;
  if (!tenantId) throw new Error("tenantId is required");
  return tenantId;
}

function readSourceAgentId(
  body: Record<string, unknown>,
  message: Record<string, unknown>,
  context: A2AJsonRpcMailboxContext | undefined,
): string {
  return readString(body, message, "sourceAgentId") ||
    context?.sourceAgentId ||
    "anonymous";
}

function readTargetAgentId(
  body: Record<string, unknown>,
  message: Record<string, unknown>,
  context: A2AJsonRpcMailboxContext | undefined,
): string {
  return readString(body, message, "targetAgentId") ||
    context?.targetAgentId ||
    "a2a-default-agent";
}

function requireString(
  body: Record<string, unknown>,
  message: Record<string, unknown>,
  key: string,
): string {
  const value = readString(body, message, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function readString(
  body: Record<string, unknown>,
  message: Record<string, unknown>,
  key: string,
): string | undefined {
  const direct = stringValue(body[key]);
  if (direct) return direct;
  const metadata = asRecord(body.metadata);
  const metadataValue = stringValue(metadata[key]);
  if (metadataValue) return metadataValue;
  const messageValue = stringValue(message[key]);
  if (messageValue) return messageValue;
  const messageMetadata = asRecord(message.metadata);
  return stringValue(messageMetadata[key]);
}

function requireTaskId(body: Record<string, unknown>): string {
  const taskId = stringValue(body.id) ?? stringValue(body.taskId);
  if (!taskId) throw new Error("task id is required");
  return taskId;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function successResponse(id: A2AJsonRpcId, result: unknown): A2AJsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(
  id: A2AJsonRpcId,
  code: number,
  message: string,
  data?: JsonValue,
): A2AJsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}
