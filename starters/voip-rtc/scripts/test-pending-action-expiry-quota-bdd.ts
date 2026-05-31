import { createInMemoryPendingActionPort } from "@voiceagentsdk/core/server";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioPendingActionExpiresAtReadTime(),
  await scenarioPendingActionQuotaLimitsOpenActionsPerSession(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioPendingActionExpiresAtReadTime(): Promise<string> {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const pendingActions = createInMemoryPendingActionPort({
    defaultTtlMs: 1000,
    idFactory: () => "pending-expiring",
    now: () => now,
  } as never);

  const created = await pendingActions.create(pendingInput("session-expiring"));
  assert(created.expiresAt, "pending action must record expiresAt");

  now = new Date("2026-01-01T00:00:02.000Z");
  const expired = await pendingActions.get?.("pending-expiring");

  assert(expired?.status === "expired", "expired pending action must fail closed at read time");
  const error = captureSyncError(() =>
    pendingActions.resolve?.({ id: "pending-expiring", status: "approved" })
  );
  assert(
    error?.message.includes("expired"),
    `expired pending action must not be approved, got ${error?.message ?? "success"}`,
  );
  return "pending-action-expires-at-read-time";
}

async function scenarioPendingActionQuotaLimitsOpenActionsPerSession(): Promise<string> {
  const pendingActions = createInMemoryPendingActionPort({
    maxPendingActionsPerSession: 1,
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  } as never);

  const first = await pendingActions.create(pendingInput("session-quota"));
  const error = captureSyncError(() => pendingActions.create(pendingInput("session-quota")));
  assert(
    error?.message.includes("maxPendingActionsPerSession"),
    `second open pending action must be rejected, got ${error?.message ?? "success"}`,
  );

  await pendingActions.resolve?.({ id: first.id, status: "rejected" });
  const next = await pendingActions.create(pendingInput("session-quota"));
  assert(next.status === "confirmation_required", "resolved pending action must free quota");

  return "pending-action-quota-limits-open-actions-per-session";
}

function pendingInput(sessionId: string) {
  return {
    sessionId,
    tenantId: "tenant-a",
    userId: "user-a",
    toolName: "send_email",
    arguments: { subject: "test" },
    sideEffect: "external_action",
  };
}

function captureSyncError(action: () => unknown): Error | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
