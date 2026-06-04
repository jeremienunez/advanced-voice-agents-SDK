import type {
  AgentMailboxMessage,
  AgentMailboxMessagePart,
  AgentMailboxMessageStatus,
} from "../types/coordination.js";
import type {
  A2AAgentCapabilities,
  A2AAgentCard,
  A2AAgentSkill,
  A2AMessage,
  A2APart,
  A2ARole,
  A2ASupportedInterface,
  A2ATask,
  A2ATaskState,
} from "./types.js";
import type { JsonValue } from "../types/json.js";

const INTERNAL_A2A_MESSAGE_ID = "a2aMessageId";
const INTERNAL_A2A_ROLE = "a2aRole";

export interface CreateA2AAgentCardInput {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion?: string;
  supportedInterfaces?: readonly A2ASupportedInterface[];
  capabilities?: A2AAgentCapabilities;
  defaultInputModes?: readonly string[];
  defaultOutputModes?: readonly string[];
  skills: readonly A2AAgentSkill[];
}

export function createA2AAgentCard(
  input: CreateA2AAgentCardInput,
): A2AAgentCard {
  return {
    name: input.name,
    description: input.description,
    url: input.url,
    version: input.version,
    protocolVersion: input.protocolVersion ?? "1.0",
    supportedInterfaces: input.supportedInterfaces ?? [{
      url: input.url,
      protocolBinding: "JSONRPC",
      protocolVersion: input.protocolVersion ?? "1.0",
    }],
    capabilities: input.capabilities ?? {},
    defaultInputModes: input.defaultInputModes ?? ["text/plain"],
    defaultOutputModes: input.defaultOutputModes ?? ["text/plain"],
    skills: input.skills,
  };
}

export function mailboxMessageToA2ATask(
  message: AgentMailboxMessage,
): A2ATask {
  const a2aMessage: A2AMessage = {
    role: mailboxRoleToA2ARole(message),
    messageId: a2aMessageId(message),
    parts: message.parts.map(mailboxPartToA2APart),
    contextId: message.contextId,
    taskId: message.taskId ?? message.id,
    referenceTaskIds: message.referenceTaskIds,
    metadata: publicMessageMetadata(message.metadata),
  };
  return {
    id: message.taskId ?? message.id,
    contextId: message.contextId,
    status: {
      state: mailboxStatusToA2ATaskState(message.status),
      timestamp: message.updatedAt,
      message: a2aMessage,
    },
    history: [a2aMessage],
    metadata: taskMetadata(message),
  };
}

export function mailboxStatusToA2ATaskState(
  status: AgentMailboxMessageStatus,
): A2ATaskState {
  if (status === "queued") return "TASK_STATE_SUBMITTED";
  if (status === "claimed") return "TASK_STATE_WORKING";
  if (status === "completed") return "TASK_STATE_COMPLETED";
  if (status === "canceled") return "TASK_STATE_CANCELED";
  return "TASK_STATE_FAILED";
}

function mailboxPartToA2APart(part: AgentMailboxMessagePart): A2APart {
  return part.kind === "text"
    ? { text: part.text, metadata: part.metadata }
    : { data: part.data, mediaType: "application/json", metadata: part.metadata };
}

function a2aMessageId(message: AgentMailboxMessage): string {
  const fromMetadata = stringMetadata(message.metadata, INTERNAL_A2A_MESSAGE_ID);
  return fromMetadata ?? message.id;
}

function mailboxRoleToA2ARole(message: AgentMailboxMessage): A2ARole {
  const role = stringMetadata(message.metadata, INTERNAL_A2A_ROLE);
  if (role === "ROLE_AGENT" || role === "agent") return "ROLE_AGENT";
  return "ROLE_USER";
}

function publicMessageMetadata(
  metadata: Record<string, JsonValue> | undefined,
): Record<string, JsonValue> | undefined {
  if (!metadata) return undefined;
  const publicMetadata = { ...metadata };
  delete publicMetadata[INTERNAL_A2A_MESSAGE_ID];
  delete publicMetadata[INTERNAL_A2A_ROLE];
  return Object.keys(publicMetadata).length ? publicMetadata : undefined;
}

function stringMetadata(
  metadata: Record<string, JsonValue> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function taskMetadata(
  message: AgentMailboxMessage,
): Record<string, JsonValue> {
  const metadata: Record<string, JsonValue> = {
    mailboxMessageId: message.id,
    sourceAgentId: message.source.agentId,
    targetAgentId: message.target.agentId,
  };
  if (message.subject) metadata.subject = message.subject;
  return metadata;
}
