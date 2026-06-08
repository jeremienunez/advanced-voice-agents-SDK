import type {
  AgentMailboxMessage,
  AgentMailboxMessagePart,
  AgentMailboxMessageStatus,
  AgentMailboxPort,
} from "../../../sdk/types.js";
import { mailboxMessageToA2ATask } from "../../../sdk/protocols/a2a.js";
import type { A2ARole, A2ATask } from "../../../sdk/protocols/types.js";
import type { JsonValue } from "../../../sdk/types/json.js";

export interface A2AMailboxMessageInput {
  role: "user" | "agent" | A2ARole;
  messageId?: string;
  parts: readonly AgentMailboxMessagePart[];
  metadata?: Record<string, JsonValue>;
}

export interface A2ASendMailboxMessageInput {
  tenantId: string;
  sourceAgentId: string;
  targetAgentId: string;
  sourceUserId?: string;
  targetUserId?: string;
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: readonly string[];
  subject?: string;
  message: A2AMailboxMessageInput;
}

export interface A2AListMailboxTasksInput {
  tenantId: string;
  targetAgentId?: string;
  sourceAgentId?: string;
  contextId?: string;
  status?: readonly AgentMailboxMessageStatus[];
  limit?: number;
}

export interface A2AGetMailboxTaskInput {
  tenantId: string;
  taskId: string;
  targetAgentId?: string;
  sourceAgentId?: string;
}

export interface A2AClaimMailboxTasksInput {
  tenantId: string;
  targetAgentId: string;
  workerId: string;
  leaseMs?: number;
  limit?: number;
}

export interface A2AAckMailboxTaskInput {
  tenantId: string;
  taskId: string;
  targetAgentId?: string;
  sourceAgentId?: string;
  status: Extract<AgentMailboxMessageStatus, "completed" | "failed" | "canceled">;
  reason?: string;
}

export interface A2AMailboxTaskRouterOptions {
  mailbox: AgentMailboxPort;
}

export interface A2AMailboxTaskRouter {
  sendMessage(input: A2ASendMailboxMessageInput): Promise<A2ATask>;
  listTasks(input: A2AListMailboxTasksInput): Promise<A2ATask[]>;
  getTask(input: A2AGetMailboxTaskInput): Promise<A2ATask | null>;
  claimTasks(input: A2AClaimMailboxTasksInput): Promise<A2ATask[]>;
  ackTask(input: A2AAckMailboxTaskInput): Promise<A2ATask>;
}

export function createA2AMailboxTaskRouter(
  options: A2AMailboxTaskRouterOptions,
): A2AMailboxTaskRouter {
  return {
    async sendMessage(input: A2ASendMailboxMessageInput): Promise<A2ATask> {
      const message = await options.mailbox.send({
        tenantId: input.tenantId,
        source: {
          agentId: input.sourceAgentId,
          userId: input.sourceUserId,
        },
        target: {
          agentId: input.targetAgentId,
          userId: input.targetUserId,
        },
        parts: input.message.parts,
        contextId: input.contextId,
        taskId: input.taskId,
        referenceTaskIds: input.referenceTaskIds,
        subject: input.subject,
        metadata: mailboxMetadata(input.message),
      });
      return mailboxMessageToA2ATask(message);
    },

    async listTasks(input: A2AListMailboxTasksInput): Promise<A2ATask[]> {
      const messages = await options.mailbox.list(input);
      return messages.map(mailboxMessageToA2ATask);
    },

    async getTask(input: A2AGetMailboxTaskInput): Promise<A2ATask | null> {
      const message = await findMailboxMessage(options.mailbox, input);
      return message ? mailboxMessageToA2ATask(message) : null;
    },

    async claimTasks(input: A2AClaimMailboxTasksInput): Promise<A2ATask[]> {
      const messages = await options.mailbox.claim(input);
      return messages.map(mailboxMessageToA2ATask);
    },

    async ackTask(input: A2AAckMailboxTaskInput): Promise<A2ATask> {
      const message = await findMailboxMessage(options.mailbox, input);
      if (!message) throw new Error(`Unknown A2A task "${input.taskId}"`);
      const acked = await options.mailbox.ack({
        messageId: message.id,
        tenantId: input.tenantId,
        targetAgentId: input.targetAgentId,
        status: input.status,
        reason: input.reason,
      });
      return mailboxMessageToA2ATask(acked);
    },
  };
}

function mailboxMetadata(
  message: A2AMailboxMessageInput,
): Record<string, JsonValue> | undefined {
  const metadata: Record<string, JsonValue> = { ...message.metadata };
  if (message.messageId) metadata.a2aMessageId = message.messageId;
  metadata.a2aRole = message.role;
  return metadata;
}

async function findMailboxMessage(
  mailbox: AgentMailboxPort,
  input: A2AGetMailboxTaskInput | A2AAckMailboxTaskInput,
): Promise<AgentMailboxMessage | undefined> {
  const messages = await mailbox.list({
    tenantId: input.tenantId,
    targetAgentId: input.targetAgentId,
    sourceAgentId: input.sourceAgentId,
  });
  return messages.find((candidate) =>
    candidate.taskId === input.taskId || candidate.id === input.taskId
  );
}
