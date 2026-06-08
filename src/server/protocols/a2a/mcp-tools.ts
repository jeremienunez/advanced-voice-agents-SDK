import type {
  VoiceSessionTool,
  VoiceSessionToolContext,
} from "../../agent/types/session.types.js";
import type { A2AMailboxTaskRouter } from "./task-router.js";

export interface A2AMailboxMcpToolsOptions {
  router: A2AMailboxTaskRouter;
}

export function createA2AMailboxMcpTools(
  options: A2AMailboxMcpToolsOptions,
): VoiceSessionTool[] {
  return [
    sendMessageTool(options.router),
    listTasksTool(options.router),
    claimTasksTool(options.router),
    ackTaskTool(options.router),
  ];
}

function sendMessageTool(router: A2AMailboxTaskRouter): VoiceSessionTool {
  return {
    type: "function",
    name: "a2a_send_message",
    description: "Send a text task to another agent through the A2A mailbox.",
    parameters: {
      type: "object",
      properties: {
        targetAgentId: { type: "string" },
        text: { type: "string" },
        sourceAgentId: { type: "string" },
        contextId: { type: "string" },
        taskId: { type: "string" },
        subject: { type: "string" },
        role: { type: "string", enum: ["user", "agent"] },
        referenceTaskIds: { type: "array" },
      },
      required: ["targetAgentId", "text"],
    },
    policy: { sideEffect: "write", executionMode: "automatic" },
    execute: async (args, context) => router.sendMessage({
      tenantId: requireTenantId(context),
      sourceAgentId: stringArg(args, "sourceAgentId") ??
        context.agentId ?? context.userId ?? "mcp",
      sourceUserId: context.userId,
      targetAgentId: requireString(args, "targetAgentId"),
      contextId: stringArg(args, "contextId"),
      taskId: stringArg(args, "taskId"),
      referenceTaskIds: stringArrayArg(args, "referenceTaskIds"),
      subject: stringArg(args, "subject"),
      message: {
        role: roleArg(args, "role") ?? "user",
        parts: [{ kind: "text", text: requireString(args, "text") }],
      },
    }),
  };
}

function listTasksTool(router: A2AMailboxTaskRouter): VoiceSessionTool {
  return {
    type: "function",
    name: "a2a_list_tasks",
    description: "List A2A mailbox tasks visible to the current tenant.",
    parameters: {
      type: "object",
      properties: {
        targetAgentId: { type: "string" },
        sourceAgentId: { type: "string" },
        contextId: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
    },
    policy: { sideEffect: "read", executionMode: "automatic" },
    execute: async (args, context) => router.listTasks({
      tenantId: requireTenantId(context),
      targetAgentId: stringArg(args, "targetAgentId"),
      sourceAgentId: stringArg(args, "sourceAgentId"),
      contextId: stringArg(args, "contextId"),
      limit: integerArg(args, "limit"),
    }),
  };
}

function claimTasksTool(router: A2AMailboxTaskRouter): VoiceSessionTool {
  return {
    type: "function",
    name: "a2a_claim_tasks",
    description: "Claim queued A2A mailbox tasks for a worker.",
    parameters: {
      type: "object",
      properties: {
        targetAgentId: { type: "string" },
        workerId: { type: "string" },
        leaseMs: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1 },
      },
    },
    policy: { sideEffect: "write", executionMode: "automatic" },
    execute: async (args, context) => router.claimTasks({
      tenantId: requireTenantId(context),
      targetAgentId: stringArg(args, "targetAgentId") ??
        context.agentId ?? requireUserId(context),
      workerId: stringArg(args, "workerId") ??
        context.userId ?? context.agentId ?? "mcp-worker",
      leaseMs: integerArg(args, "leaseMs"),
      limit: integerArg(args, "limit"),
    }),
  };
}

function ackTaskTool(router: A2AMailboxTaskRouter): VoiceSessionTool {
  return {
    type: "function",
    name: "a2a_ack_task",
    description: "Acknowledge an A2A mailbox task as completed, failed, or canceled.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        targetAgentId: { type: "string" },
        sourceAgentId: { type: "string" },
        status: { type: "string", enum: ["completed", "failed", "canceled"] },
        reason: { type: "string" },
      },
      required: ["taskId", "status"],
    },
    policy: { sideEffect: "write", executionMode: "automatic" },
    execute: async (args, context) => router.ackTask({
      tenantId: requireTenantId(context),
      targetAgentId: stringArg(args, "targetAgentId") ?? context.agentId,
      sourceAgentId: stringArg(args, "sourceAgentId"),
      taskId: requireString(args, "taskId"),
      status: ackStatusArg(args, "status"),
      reason: stringArg(args, "reason"),
    }),
  };
}

function requireTenantId(context: VoiceSessionToolContext): string {
  if (context.tenantId) return context.tenantId;
  throw new Error("A2A mailbox MCP tools require context.tenantId");
}

function requireUserId(context: VoiceSessionToolContext): string {
  if (context.userId) return context.userId;
  throw new Error("A2A mailbox MCP tools require context.userId or context.agentId");
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = stringArg(args, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayArg(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length ? items : undefined;
}

function integerArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function roleArg(
  args: Record<string, unknown>,
  key: string,
): "user" | "agent" | undefined {
  const value = args[key];
  return value === "user" || value === "agent" ? value : undefined;
}

function ackStatusArg(
  args: Record<string, unknown>,
  key: string,
): "completed" | "failed" | "canceled" {
  const value = args[key];
  if (value === "completed" || value === "failed" || value === "canceled") {
    return value;
  }
  throw new Error(`${key} must be completed, failed, or canceled`);
}
