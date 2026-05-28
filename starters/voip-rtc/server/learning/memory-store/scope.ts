import type { TemporalMemoryScope } from "@voiceagentsdk/core/sdk";

export function scopeMatches(
  record: TemporalMemoryScope,
  requested: TemporalMemoryScope,
): boolean {
  return matches(record.tenantId, requested.tenantId) &&
    matches(record.agentId, requested.agentId) &&
    matches(record.userId, requested.userId);
}

function matches(recordValue: string | undefined, requestedValue: string | undefined) {
  return !requestedValue || recordValue === requestedValue;
}
