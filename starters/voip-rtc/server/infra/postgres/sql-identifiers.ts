import type { DatabaseBuildPlan } from "@voiceagentsdk/core/sdk";

export function agentSchemaName(draftId: string): string {
  const normalized = draftId
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = normalized || "draft";
  return `agent_${suffix}`.slice(0, 60);
}

export function appliedAgentSchema(
  plan?: DatabaseBuildPlan,
): string | undefined {
  if (!plan || plan.status !== "applied") return undefined;
  if (!isSafeIdentifier(plan.schemaName)) return undefined;
  return plan.schemaName;
}

export function quoteIdentifier(identifier: string): string {
  if (!isSafeIdentifier(identifier)) {
    throw new Error(`Unsafe SQL identifier "${identifier}"`);
  }
  return `"${identifier}"`;
}

export function isSafeIdentifier(identifier: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(identifier);
}
