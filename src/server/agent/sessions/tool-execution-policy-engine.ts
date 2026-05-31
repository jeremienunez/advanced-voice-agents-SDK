import type {
  PendingActionPort,
  PendingActionRecord,
  RuntimeEventRecord,
} from "../../../sdk/types.js";
import type { VoiceSessionTool, VoiceSessionToolContext } from "../types/session.types.js";
import { createInMemoryPendingActionPort } from "./pending-action-port.js";
import {
  assertApprovedPendingAction,
  requiresServerConfirmation,
  validateArguments,
} from "./tool-execution-policy-validation.js";
import {
  errorMessage,
  redact,
  timeoutMs,
  withTimeout,
} from "./tool-execution-policy-runtime.js";

export interface ToolExecutionPolicyInput {
  tool: VoiceSessionTool;
  args: Record<string, unknown>;
  context: VoiceSessionToolContext;
}

export interface ApprovedPendingActionExecutionInput {
  pendingActionId: string;
  tool: VoiceSessionTool;
  context: VoiceSessionToolContext;
}

export interface ToolExecutionPolicyAuditEvent extends RuntimeEventRecord {
  type:
    | "tool.confirmation_required"
    | "tool.started"
    | "tool.completed"
    | "tool.rejected"
    | "tool.failed";
  toolName: string;
  sessionId: string;
  reason?: string;
  pendingActionId?: string;
}

export type ToolAuthorizationResult = boolean | { allowed: boolean; reason?: string };

export interface ToolExecutionPolicyEngineOptions {
  pendingActions?: PendingActionPort;
  authorize?: (
    input: ToolExecutionPolicyInput,
  ) => ToolAuthorizationResult | Promise<ToolAuthorizationResult>;
  audit?: (event: ToolExecutionPolicyAuditEvent) => void | Promise<void>;
  now?: () => Date;
  defaultTimeoutMs?: number;
  pendingActionTtlMs?: number;
  maxPendingActionsPerSession?: number;
}

export class ToolExecutionPolicyEngine {
  private readonly callCounts = new Map<string, number>();
  private readonly pendingActions: PendingActionPort;

  constructor(private readonly options: ToolExecutionPolicyEngineOptions = {}) {
    this.pendingActions = options.pendingActions ??
      createInMemoryPendingActionPort({
        defaultTtlMs: options.pendingActionTtlMs,
        maxPendingActionsPerSession: options.maxPendingActionsPerSession,
        now: options.now,
      });
  }

  async execute(input: ToolExecutionPolicyInput): Promise<unknown> {
    let args: Record<string, unknown>;
    try {
      args = validateArguments(input.tool, input.args);
    } catch (error) {
      await this.audit(input, "tool.rejected", errorMessage(error));
      throw error;
    }
    const auth = await this.authorize(input, args);
    if (!auth.allowed) {
      await this.audit(input, "tool.rejected", auth.reason ?? "tool not authorized");
      throw new Error(`Tool "${input.tool.name}" is not authorized`);
    }

    const limitError = this.callLimitError(input);
    if (limitError) {
      await this.audit(input, "tool.rejected", limitError);
      throw new Error(limitError);
    }

    if (requiresServerConfirmation(input.tool)) {
      const pending = await this.pendingActions.create({
        sessionId: input.context.sessionId,
        tenantId: input.context.tenantId,
        userId: input.context.userId,
        providerId: input.context.providerId,
        toolName: input.tool.name,
        arguments: args,
        sideEffect: input.tool.policy?.sideEffect,
        reason: input.tool.policy?.confirmationReason ??
          "Server-side confirmation is required before this action.",
        expiresAt: pendingExpiresAt(this.options),
        metadata: input.context.agentId ? { agentId: input.context.agentId } : undefined,
      });
      await this.audit(input, "tool.confirmation_required", pending.reason, pending.id);
      return {
        status: "confirmation_required",
        pendingActionId: pending.id,
        toolName: input.tool.name,
        reason: pending.reason,
        expiresAt: pending.expiresAt,
      };
    }

    await this.audit(input, "tool.started");
    this.incrementCallCount(input);
    try {
      const result = await withTimeout(
        input.tool.execute(args, input.context),
        timeoutMs(input.tool, this.options.defaultTimeoutMs),
        input.tool.name,
      );
      await this.audit(input, "tool.completed");
      return input.tool.policy?.redactResult === false ? result : redact(result);
    } catch (error) {
      await this.audit(input, "tool.failed", errorMessage(error));
      throw error;
    }
  }

  async executeApprovedPendingAction(
    input: ApprovedPendingActionExecutionInput,
  ): Promise<unknown> {
    const pending = await this.requirePendingAction(input.pendingActionId);
    assertApprovedPendingAction(pending, input);
    const args = validateArguments(input.tool, pending.arguments);
    const policyInput = { tool: input.tool, args, context: input.context };
    const auth = await this.authorize(policyInput, args);
    if (!auth.allowed) {
      await this.audit(policyInput, "tool.rejected", auth.reason ?? "tool not authorized", pending.id);
      throw new Error(`Tool "${input.tool.name}" is not authorized`);
    }
    const limitError = this.callLimitError(policyInput);
    if (limitError) {
      await this.audit(policyInput, "tool.rejected", limitError, pending.id);
      throw new Error(limitError);
    }

    await this.audit(policyInput, "tool.started", undefined, pending.id);
    this.incrementCallCount(policyInput);
    try {
      const result = await withTimeout(
        input.tool.execute(args, input.context),
        timeoutMs(input.tool, this.options.defaultTimeoutMs),
        input.tool.name,
      );
      await this.resolvePendingAction(pending.id, "executed");
      await this.audit(policyInput, "tool.completed", undefined, pending.id);
      return input.tool.policy?.redactResult === false ? result : redact(result);
    } catch (error) {
      await this.resolvePendingAction(pending.id, "failed", errorMessage(error));
      await this.audit(policyInput, "tool.failed", errorMessage(error), pending.id);
      throw error;
    }
  }

  private async authorize(
    input: ToolExecutionPolicyInput,
    args: Record<string, unknown>,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const result = await this.options.authorize?.({ ...input, args });
    if (result === undefined || result === true) return { allowed: true };
    if (result === false) return { allowed: false };
    return result;
  }

  private callLimitError(input: ToolExecutionPolicyInput): string | null {
    const limit = input.tool.policy?.maxCallsPerSession;
    if (!Number.isFinite(limit) || !limit || limit < 1) return null;
    const key = callCountKey(input);
    const current = this.callCounts.get(key) ?? 0;
    return current >= limit
      ? `Tool "${input.tool.name}" exceeded maxCallsPerSession ${limit}`
      : null;
  }

  private incrementCallCount(input: ToolExecutionPolicyInput): void {
    const key = callCountKey(input);
    this.callCounts.set(key, (this.callCounts.get(key) ?? 0) + 1);
  }

  private async requirePendingAction(id: string): Promise<PendingActionRecord> {
    if (!this.pendingActions.get) {
      throw new Error("PendingActionPort.get is required for approved execution");
    }
    const pending = await this.pendingActions.get(id);
    if (!pending) throw new Error(`Unknown pending action "${id}"`);
    return pending;
  }

  private async resolvePendingAction(
    id: string,
    status: "executed" | "failed",
    reason?: string,
  ): Promise<void> {
    await this.pendingActions.resolve?.({ id, status, reason });
  }

  private async audit(
    input: ToolExecutionPolicyInput,
    type: ToolExecutionPolicyAuditEvent["type"],
    reason?: string,
    pendingActionId?: string,
  ): Promise<void> {
    await this.options.audit?.({
      type,
      toolName: input.tool.name,
      sessionId: input.context.sessionId,
      timestamp: this.options.now?.().getTime() ?? Date.now(),
      reason,
      pendingActionId,
      metadata: {
        tenantId: input.context.tenantId,
        userId: input.context.userId,
        providerId: input.context.providerId,
      },
    });
  }
}

function callCountKey(input: ToolExecutionPolicyInput): string {
  return `${input.context.sessionId}:${input.tool.name}`;
}

function pendingExpiresAt(
  options: ToolExecutionPolicyEngineOptions,
): string | undefined {
  const ttlMs = options.pendingActionTtlMs;
  if (!Number.isFinite(ttlMs) || !ttlMs || ttlMs < 1) return undefined;
  const now = options.now?.() ?? new Date();
  return new Date(now.getTime() + ttlMs).toISOString();
}
