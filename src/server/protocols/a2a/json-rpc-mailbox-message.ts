import type { AgentMailboxMessagePart } from "../../../sdk/types.js";
import type { JsonValue } from "../../../sdk/types/json.js";
import { asRecord } from "./json-rpc-mailbox-readers.js";

export function readParts(value: unknown): readonly AgentMailboxMessagePart[] {
  if (!Array.isArray(value)) throw new Error("message.parts is required");
  const parts = value.map((item) => {
    const part = asRecord(item);
    if (typeof part.text === "string") {
      return { kind: "text" as const, text: part.text };
    }
    if (part.data !== undefined) {
      return { kind: "data" as const, data: jsonData(part.data) };
    }
    throw new Error("message.parts contains an unsupported part");
  });
  if (parts.length === 0) throw new Error("message.parts is required");
  return parts;
}

export function readA2ARole(
  value: unknown,
): "user" | "agent" | "ROLE_USER" | "ROLE_AGENT" {
  if (value === "agent" || value === "ROLE_AGENT") return "ROLE_AGENT";
  return "ROLE_USER";
}

function jsonData(value: unknown): JsonValue {
  return isJsonValue(value) ? value : null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}
