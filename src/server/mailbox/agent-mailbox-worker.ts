import type {
  AgentMailboxMessage,
  AgentMailboxMessageStatus,
  AgentMailboxPort,
} from "../../sdk/types.js";

type TerminalMailboxStatus = Extract<
  AgentMailboxMessageStatus,
  "completed" | "failed" | "canceled"
>;

export interface AgentMailboxWorkerHandlerContext {
  tenantId: string;
  targetAgentId: string;
  workerId: string;
}

export interface AgentMailboxWorkerHandlerResult {
  reason?: string;
  status?: TerminalMailboxStatus;
}

export interface AgentMailboxWorkerOptions {
  mailbox: AgentMailboxPort;
  tenantId: string;
  targetAgentId: string;
  workerId: string;
  leaseMs?: number;
  batchSize?: number;
  concurrency?: number;
  handleMessage(
    message: AgentMailboxMessage,
    context: AgentMailboxWorkerHandlerContext,
  ): void | AgentMailboxWorkerHandlerResult | Promise<void | AgentMailboxWorkerHandlerResult>;
}

export interface AgentMailboxWorkerRunResult {
  claimed: number;
  completed: number;
  failed: number;
  canceled: number;
  processedMessageIds: string[];
}

export interface AgentMailboxWorker {
  runOnce(): Promise<AgentMailboxWorkerRunResult>;
}

export function createAgentMailboxWorker(
  options: AgentMailboxWorkerOptions,
): AgentMailboxWorker {
  return {
    async runOnce(): Promise<AgentMailboxWorkerRunResult> {
      const claimed = await options.mailbox.claim({
        tenantId: options.tenantId,
        targetAgentId: options.targetAgentId,
        workerId: options.workerId,
        leaseMs: options.leaseMs,
        limit: batchSize(options),
      });
      const result: AgentMailboxWorkerRunResult = {
        claimed: claimed.length,
        completed: 0,
        failed: 0,
        canceled: 0,
        processedMessageIds: [],
      };
      let cursor = 0;
      const loops = Array.from(
        { length: Math.min(concurrency(options), claimed.length) },
        async () => {
          while (cursor < claimed.length) {
            const message = claimed[cursor++];
            if (message) await processMessage(options, message, result);
          }
        },
      );
      await Promise.all(loops);
      return result;
    },
  };
}

async function processMessage(
  options: AgentMailboxWorkerOptions,
  message: AgentMailboxMessage,
  run: AgentMailboxWorkerRunResult,
): Promise<void> {
  try {
    const handled = await options.handleMessage(message, {
      tenantId: options.tenantId,
      targetAgentId: options.targetAgentId,
      workerId: options.workerId,
    });
    await ack(options, message, handled?.status ?? "completed", handled?.reason);
    increment(run, handled?.status ?? "completed");
  } catch (error) {
    await ack(options, message, "failed", errorMessage(error));
    increment(run, "failed");
  }
  run.processedMessageIds.push(message.id);
}

async function ack(
  options: AgentMailboxWorkerOptions,
  message: AgentMailboxMessage,
  status: TerminalMailboxStatus,
  reason: string | undefined,
): Promise<void> {
  await options.mailbox.ack({
    messageId: message.id,
    tenantId: options.tenantId,
    targetAgentId: options.targetAgentId,
    status,
    reason,
  });
}

function increment(
  result: AgentMailboxWorkerRunResult,
  status: TerminalMailboxStatus,
): void {
  if (status === "completed") result.completed += 1;
  if (status === "failed") result.failed += 1;
  if (status === "canceled") result.canceled += 1;
}

function batchSize(options: AgentMailboxWorkerOptions): number {
  return positiveInteger(options.batchSize) ??
    positiveInteger(options.concurrency) ??
    1;
}

function concurrency(options: AgentMailboxWorkerOptions): number {
  return positiveInteger(options.concurrency) ?? 1;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
