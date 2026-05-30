import type { PendingActionPort, RuntimeEventRecord } from "../../../sdk/types.js";
import type { VoiceSessionTool, VoiceSessionToolContext } from "../types/session.types.js";
import { createInMemoryPendingActionPort } from "./pending-action-port.js";

export interface ToolExecutionPolicyInput {
  tool: VoiceSessionTool;
  args: Record<string, unknown>;
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
}

export class ToolExecutionPolicyEngine {
  private readonly callCounts = new Map<string, number>();
  private readonly pendingActions: PendingActionPort;

  constructor(private readonly options: ToolExecutionPolicyEngineOptions = {}) {
    this.pendingActions = options.pendingActions ??
      createInMemoryPendingActionPort({ now: options.now });
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
      });
      await this.audit(input, "tool.confirmation_required", pending.reason, pending.id);
      return {
        status: "confirmation_required",
        pendingActionId: pending.id,
        toolName: input.tool.name,
        reason: pending.reason,
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

function validateArguments(
  tool: VoiceSessionTool,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const schema = tool.parameters;
  if (schema.type && schema.type !== "object") {
    throw new Error(`Tool "${tool.name}" parameters must be an object schema`);
  }
  const required = stringArray(schema.required);
  for (const key of required) {
    if (args[key] === undefined) {
      throw new Error(`Tool "${tool.name}" argument "${key}" is required`);
    }
  }
  const properties = record(schema.properties);
  for (const [key, value] of Object.entries(args)) {
    const property = record(properties[key]);
    if (!property) continue;
    validateValue(tool.name, key, value, property);
  }
  return { ...args };
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
  if (typeof value === "number") {
    const minimum = numberValue(schema.minimum);
    const maximum = numberValue(schema.maximum);
    if (minimum !== undefined && value < minimum) {
      throw new Error(`Tool "${toolName}" argument "${key}" is below minimum`);
    }
    if (maximum !== undefined && value > maximum) {
      throw new Error(`Tool "${toolName}" argument "${key}" is above maximum`);
    }
  }
}

function matchesJsonType(value: unknown, expected: string): boolean {
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
  return typeof value === expected;
}

function requiresServerConfirmation(tool: VoiceSessionTool): boolean {
  const sideEffect = tool.policy?.sideEffect;
  return tool.policy?.executionMode === "confirmation" ||
    sideEffect === "write" ||
    sideEffect === "external_action" ||
    sideEffect === "handoff";
}

function timeoutMs(tool: VoiceSessionTool, fallback: number | undefined): number {
  const configured = tool.policy?.timeoutMs ?? fallback ?? 10_000;
  return Number.isFinite(configured) && configured > 0 ? configured : 10_000;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  toolName: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function callCountKey(input: ToolExecutionPolicyInput): string {
  return `${input.context.sessionId}:${input.tool.name}`;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactString(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      shouldRedactKey(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}

function redactString(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function shouldRedactKey(key: string): boolean {
  return /api[_-]?key|authorization|bearer|password|secret|token/i.test(key);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
