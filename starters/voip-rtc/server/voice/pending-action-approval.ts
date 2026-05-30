import type {
  AuthTicketIdentity,
  PendingActionPort,
  PendingActionRecord,
} from "@voiceagentsdk/core/sdk";
import type {
  ToolExecutionPolicyEngine,
  VoiceSessionTool,
  VoiceSessionToolContext,
} from "@voiceagentsdk/core/server";
import type { BuilderRequestContext } from "../builder/types.js";

export interface RuntimePendingActionApprovalService {
  approve(
    pendingActionId: string,
    context: BuilderRequestContext,
  ): Promise<unknown>;
  reject(
    pendingActionId: string,
    context: BuilderRequestContext,
  ): Promise<PendingActionRecord>;
}

export interface RuntimePendingActionApprovalOptions {
  pendingActions: PendingActionPort;
  toolPolicyEngine: ToolExecutionPolicyEngine;
  resolveTools(
    pending: PendingActionRecord,
  ): readonly VoiceSessionTool[] | Promise<readonly VoiceSessionTool[]>;
}

export function createRuntimePendingActionApprovalService(
  options: RuntimePendingActionApprovalOptions,
): RuntimePendingActionApprovalService {
  return {
    async approve(pendingActionId, context) {
      const pending = await requirePendingAction(options.pendingActions, pendingActionId);
      assertPendingOwnedBy(pending, context.identity);
      assertPendingAwaitingConfirmation(pending);
      await resolvePendingAction(options.pendingActions, pending.id, "approved");
      const tool = await requirePendingTool(options, pending);
      return options.toolPolicyEngine.executeApprovedPendingAction({
        pendingActionId: pending.id,
        tool,
        context: toolContextFromPending(pending),
      });
    },

    async reject(pendingActionId, context) {
      const pending = await requirePendingAction(options.pendingActions, pendingActionId);
      assertPendingOwnedBy(pending, context.identity);
      assertPendingAwaitingConfirmation(pending);
      return resolvePendingAction(options.pendingActions, pending.id, "rejected");
    },
  };
}

async function requirePendingAction(
  pendingActions: PendingActionPort,
  pendingActionId: string,
): Promise<PendingActionRecord> {
  if (!pendingActions.get) {
    throw new Error("PendingActionPort.get is required for approval");
  }
  const pending = await pendingActions.get(pendingActionId);
  if (!pending) throw new Error(`Unknown pending action "${pendingActionId}"`);
  return pending;
}

function assertPendingOwnedBy(
  pending: PendingActionRecord,
  identity: AuthTicketIdentity | undefined,
): void {
  if (!identity || pending.tenantId !== identity.tenantId) {
    throw new Error(`Pending action "${pending.id}" is not owned by authenticated identity`);
  }
  if (pending.userId && pending.userId !== identity.userId) {
    throw new Error(`Pending action "${pending.id}" is not owned by authenticated identity`);
  }
}

function assertPendingAwaitingConfirmation(pending: PendingActionRecord): void {
  if (pending.status !== "confirmation_required") {
    throw new Error(`Pending action "${pending.id}" is not awaiting confirmation`);
  }
}

async function resolvePendingAction(
  pendingActions: PendingActionPort,
  pendingActionId: string,
  status: "approved" | "rejected",
): Promise<PendingActionRecord> {
  if (!pendingActions.resolve) {
    throw new Error("PendingActionPort.resolve is required for approval");
  }
  return pendingActions.resolve({ id: pendingActionId, status });
}

async function requirePendingTool(
  options: RuntimePendingActionApprovalOptions,
  pending: PendingActionRecord,
): Promise<VoiceSessionTool> {
  const tools = await options.resolveTools(pending);
  const tool = tools.find((candidate) => candidate.name === pending.toolName);
  if (!tool) {
    throw new Error(`Tool "${pending.toolName}" is not available for pending action`);
  }
  return tool;
}

function toolContextFromPending(
  pending: PendingActionRecord,
): VoiceSessionToolContext {
  return {
    sessionId: pending.sessionId,
    tenantId: pending.tenantId,
    userId: pending.userId,
    providerId: pending.providerId,
    agentId: metadataString(pending, "agentId"),
  };
}

function metadataString(
  pending: PendingActionRecord,
  key: string,
): string | undefined {
  const value = pending.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
