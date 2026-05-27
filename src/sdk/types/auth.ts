import type { JsonObject } from "./json.js";

export type AuthTicketChannel = "builder" | "voice" | "custom";

export interface AuthTicketInput {
  channel: AuthTicketChannel;
  origin?: string;
  requestedTenantId?: string;
  requestedUserId?: string;
  requestedPlanId?: string;
  token?: string;
  metadata?: JsonObject;
}

export interface AuthTicketIdentity {
  tenantId: string;
  userId?: string;
  planId?: string;
  scopes?: string[];
  metadata?: JsonObject;
}

export interface AuthTicketPort {
  verifyTicket(
    input: AuthTicketInput,
  ): Promise<AuthTicketIdentity | null> | AuthTicketIdentity | null;
}
