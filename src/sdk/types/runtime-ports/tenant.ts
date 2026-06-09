import type { AgentChannel, PlanId, ProviderId, TenantId } from "../core/index.js";

export interface TenantResolutionInput {
  channel: AgentChannel;
  provider?: string;
  from?: string;
  to?: string;
  callId?: string;
  accountId?: string;
}

export interface TenantResolutionResult {
  tenantId: TenantId;
  providerId: ProviderId;
  mediaBridgeId: string;
  planId: PlanId;
  userId?: string;
  limits?: Record<string, number>;
  promptVariables?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
}

export interface TenantResolverPort {
  resolveTenant(input: TenantResolutionInput): TenantResolutionResult;
}
