import type { PendingActionRecord } from "../../../sdk/types.js";
import type {
  VoiceSessionTool,
  VoiceSessionToolContext,
} from "../types/session.types.js";

export function assertApprovedPendingAction(
  pending: PendingActionRecord,
  input: { tool: VoiceSessionTool; context: VoiceSessionToolContext },
): void {
  if (pending.status !== "approved") {
    throw new Error(`Pending action "${pending.id}" must be approved before execution`);
  }
  const context = input.context;
  const mismatches = [
    pending.sessionId !== context.sessionId ? "sessionId" : "",
    pending.tenantId && pending.tenantId !== context.tenantId ? "tenantId" : "",
    pending.userId && pending.userId !== context.userId ? "userId" : "",
    pending.providerId && pending.providerId !== context.providerId ? "providerId" : "",
    pending.toolName !== input.tool.name ? "toolName" : "",
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new Error(
      `Pending action "${pending.id}" does not match execution context: ${mismatches.join(", ")}`,
    );
  }
}

export function validateArguments(
  tool: VoiceSessionTool,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const schema = tool.parameters;
  if (schema.type && schema.type !== "object") {
    throw new Error(`Tool "${tool.name}" parameters must be an object schema`);
  }
  for (const key of stringArray(schema.required)) {
    if (args[key] === undefined) {
      throw new Error(`Tool "${tool.name}" argument "${key}" is required`);
    }
  }
  const properties = record(schema.properties);
  for (const [key, value] of Object.entries(args)) {
    const property = record(properties[key]);
    if (property) validateValue(tool.name, key, value, property);
  }
  return { ...args };
}

export function requiresServerConfirmation(tool: VoiceSessionTool): boolean {
  const sideEffect = tool.policy?.sideEffect;
  return tool.policy?.executionMode === "confirmation" ||
    sideEffect === "write" ||
    sideEffect === "external_action" ||
    sideEffect === "handoff";
}

function validateValue(
  toolName: string,
  key: string,
  value: unknown,
  schema: Record<string, unknown>,
): void {
  const expected = schema.type;
  if (typeof expected === "string" && !matchesJsonType(value, expected)) {
    throw new Error(`Tool "${toolName}" argument "${key}" must be ${expected}`);
  }
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;
  if (enumValues && !enumValues.includes(value)) {
    throw new Error(`Tool "${toolName}" argument "${key}" is not allowed`);
  }
  validateNumericRange(toolName, key, value, schema);
}

function validateNumericRange(
  toolName: string,
  key: string,
  value: unknown,
  schema: Record<string, unknown>,
): void {
  if (typeof value !== "number") return;
  const minimum = numberValue(schema.minimum);
  const maximum = numberValue(schema.maximum);
  if (minimum !== undefined && value < minimum) {
    throw new Error(`Tool "${toolName}" argument "${key}" is below minimum`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new Error(`Tool "${toolName}" argument "${key}" is above maximum`);
  }
}

function matchesJsonType(value: unknown, expected: string): boolean {
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return typeof value === expected;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
