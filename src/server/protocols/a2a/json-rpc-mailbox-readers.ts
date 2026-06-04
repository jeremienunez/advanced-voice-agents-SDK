import type { AgentMailboxMessageStatus } from "../../../sdk/types.js";
import type { JsonValue } from "../../../sdk/types/json.js";

export function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length ? values : undefined;
}

export function readPositiveInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function readMailboxStatuses(
  value: unknown,
): readonly AgentMailboxMessageStatus[] | undefined {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const statuses = raw.map(mailboxStatus).filter(isMailboxStatus);
  return statuses.length ? statuses : undefined;
}

export function asJsonObject(
  value: unknown,
): Record<string, JsonValue> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, JsonValue] =>
    isJsonValue(entry[1])
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function mailboxStatus(value: unknown): AgentMailboxMessageStatus | null {
  if (value === "queued" || value === "submitted" || value === "TASK_STATE_SUBMITTED") {
    return "queued";
  }
  if (value === "claimed" || value === "working" || value === "TASK_STATE_WORKING") {
    return "claimed";
  }
  if (value === "completed" || value === "TASK_STATE_COMPLETED") return "completed";
  if (value === "failed" || value === "TASK_STATE_FAILED") return "failed";
  if (value === "canceled" || value === "TASK_STATE_CANCELED") return "canceled";
  return null;
}

function isMailboxStatus(
  value: AgentMailboxMessageStatus | null,
): value is AgentMailboxMessageStatus {
  return value !== null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}
