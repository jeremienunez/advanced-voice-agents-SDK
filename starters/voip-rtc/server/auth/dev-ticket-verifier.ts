import type {
  AuthTicketIdentity,
  AuthTicketInput,
  AuthTicketPort,
} from "@voiceagentsdk/core/sdk";
import type { StarterServerEnv } from "../http/types.js";

export function createDevAuthTicketVerifier(
  env: StarterServerEnv,
): AuthTicketPort {
  if (env.mode === "production") {
    throw new Error(
      "DevAuthTicketVerifier is local-only and cannot be used when VOICE_STARTER_MODE=production",
    );
  }
  return new DevAuthTicketVerifier({
    allowUnauthenticated: !env.authToken,
    authToken: env.authToken,
  });
}

class DevAuthTicketVerifier implements AuthTicketPort {
  constructor(
    private readonly config: {
      allowUnauthenticated: boolean;
      authToken?: string;
    },
  ) {}

  verifyTicket(input: AuthTicketInput): AuthTicketIdentity | null {
    if (this.config.authToken && input.token !== this.config.authToken) {
      return null;
    }
    if (!this.config.authToken && !this.config.allowUnauthenticated) {
      return null;
    }
    return {
      tenantId: input.requestedTenantId ?? "local",
      userId: input.requestedUserId ?? "demo",
      planId: input.requestedPlanId ?? "dev",
      scopes: [`${input.channel}:access`],
      metadata: { authMode: this.config.authToken ? "dev-token" : "local-dev" },
    };
  }
}
