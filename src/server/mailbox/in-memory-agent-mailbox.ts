import type {
  AgentMailboxAckInput,
  AgentMailboxClaimInput,
  AgentMailboxListInput,
  AgentMailboxMessage,
  AgentMailboxPort,
  AgentMailboxSendInput,
  AgentMailboxSubscribeInput,
} from "../../sdk/types.js";

export interface InMemoryAgentMailboxOptions {
  idFactory?: () => string;
  now?: () => Date;
}

type Subscription = {
  input: AgentMailboxSubscribeInput;
  handler: (message: AgentMailboxMessage) => void | Promise<void>;
};

export function createInMemoryAgentMailbox(
  options: InMemoryAgentMailboxOptions = {},
): AgentMailboxPort {
  return new InMemoryAgentMailbox(options);
}

class InMemoryAgentMailbox implements AgentMailboxPort {
  private readonly messages = new Map<string, AgentMailboxMessage>();
  private readonly subscriptions = new Set<Subscription>();

  constructor(private readonly options: InMemoryAgentMailboxOptions) {}

  send(input: AgentMailboxSendInput): AgentMailboxMessage {
    const existing = this.idempotentMessage(input);
    if (existing) return cloneMessage(existing);
    const now = this.now();
    const message: AgentMailboxMessage = {
      ...input,
      id: this.options.idFactory?.() ?? `mail_${crypto.randomUUID()}`,
      status: "queued",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.messages.set(message.id, message);
    void this.notify(message);
    return cloneMessage(message);
  }

  list(input: AgentMailboxListInput): AgentMailboxMessage[] {
    const messages = Array.from(this.messages.values())
      .filter((message) => messageMatchesList(message, input))
      .sort(newestUpdatedFirst);
    return (input.limit === undefined ? messages : messages.slice(0, input.limit))
      .map(cloneMessage);
  }

  claim(input: AgentMailboxClaimInput): AgentMailboxMessage[] {
    const now = this.now();
    const candidates = Array.from(this.messages.values())
      .filter((message) => messageClaimable(message, input, now))
      .sort(oldestUpdatedFirst)
      .slice(0, input.limit ?? 1);
    const claimed = candidates.map((message) => {
      const next: AgentMailboxMessage = {
        ...message,
        status: "claimed",
        claimedAt: now.toISOString(),
        claimedBy: input.workerId,
        leaseExpiresAt: input.leaseMs
          ? new Date(now.getTime() + input.leaseMs).toISOString()
          : undefined,
        updatedAt: now.toISOString(),
      };
      this.messages.set(next.id, next);
      void this.notify(next);
      return cloneMessage(next);
    });
    return claimed;
  }

  ack(input: AgentMailboxAckInput): AgentMailboxMessage {
    const current = this.messages.get(input.messageId);
    if (!current || current.tenantId !== input.tenantId) {
      throw new Error(`Unknown mailbox message "${input.messageId}"`);
    }
    if (input.targetAgentId && current.target.agentId !== input.targetAgentId) {
      throw new Error(`Mailbox message "${input.messageId}" is not owned by target agent`);
    }
    const now = this.now();
    const next: AgentMailboxMessage = {
      ...current,
      status: input.status,
      failureReason: input.reason,
      ackedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.messages.set(next.id, next);
    void this.notify(next);
    return cloneMessage(next);
  }

  subscribe(
    input: AgentMailboxSubscribeInput,
    handler: (message: AgentMailboxMessage) => void | Promise<void>,
  ): () => void {
    const subscription = { input, handler };
    this.subscriptions.add(subscription);
    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  private idempotentMessage(
    input: AgentMailboxSendInput,
  ): AgentMailboxMessage | undefined {
    if (!input.idempotencyKey) return undefined;
    return Array.from(this.messages.values()).find((message) =>
      message.tenantId === input.tenantId &&
      message.idempotencyKey === input.idempotencyKey &&
      message.source.agentId === input.source.agentId &&
      message.target.agentId === input.target.agentId
    );
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private async notify(message: AgentMailboxMessage): Promise<void> {
    await Promise.all(
      Array.from(this.subscriptions)
        .filter((subscription) =>
          messageMatchesSubscription(message, subscription.input)
        )
        .map((subscription) => subscription.handler(cloneMessage(message))),
    );
  }
}

function messageMatchesList(
  message: AgentMailboxMessage,
  input: AgentMailboxListInput,
): boolean {
  return message.tenantId === input.tenantId &&
    (!input.targetAgentId || message.target.agentId === input.targetAgentId) &&
    (!input.sourceAgentId || message.source.agentId === input.sourceAgentId) &&
    (!input.contextId || message.contextId === input.contextId) &&
    (!input.status || input.status.includes(message.status));
}

function messageClaimable(
  message: AgentMailboxMessage,
  input: AgentMailboxClaimInput,
  now: Date,
): boolean {
  if (message.tenantId !== input.tenantId) return false;
  if (message.target.agentId !== input.targetAgentId) return false;
  if (message.status === "queued") return true;
  if (message.status !== "claimed" || !message.leaseExpiresAt) return false;
  return Date.parse(message.leaseExpiresAt) <= now.getTime();
}

function messageMatchesSubscription(
  message: AgentMailboxMessage,
  input: AgentMailboxSubscribeInput,
): boolean {
  return message.tenantId === input.tenantId &&
    (!input.targetAgentId || message.target.agentId === input.targetAgentId) &&
    (!input.contextId || message.contextId === input.contextId);
}

function newestUpdatedFirst(
  left: AgentMailboxMessage,
  right: AgentMailboxMessage,
): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function oldestUpdatedFirst(
  left: AgentMailboxMessage,
  right: AgentMailboxMessage,
): number {
  return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
}

function cloneMessage(message: AgentMailboxMessage): AgentMailboxMessage {
  return {
    ...message,
    source: { ...message.source },
    target: { ...message.target },
    parts: message.parts.map((part) => ({ ...part })),
    referenceTaskIds: message.referenceTaskIds
      ? [...message.referenceTaskIds]
      : undefined,
    metadata: message.metadata ? { ...message.metadata } : undefined,
  };
}
