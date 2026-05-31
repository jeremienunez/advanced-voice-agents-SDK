# App-Owned Integration Examples

`@voiceagentsdk/core` does not own accounts, production auth, tenant storage,
secret backends, or approval UX. Production applications plug those concerns in
through SDK ports.

## AuthTicketPort Patterns

### No-Auth Local

```ts
import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";

export const localAuth: AuthTicketPort = {
  verifyTicket(input) {
    return {
      tenantId: input.requestedTenantId ?? "local",
      userId: input.requestedUserId ?? "demo",
      planId: input.requestedPlanId ?? "dev",
      scopes: ["builder", "voice"],
    };
  },
};
```

### JWT Integration

```ts
import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";

export function jwtAuth(verifyJwt: (token: string) => Promise<{
  sub: string;
  tenant: string;
  scopes?: string[];
}>): AuthTicketPort {
  return {
    async verifyTicket(input) {
      if (!input.token) return null;
      const claims = await verifyJwt(input.token);
      return {
        tenantId: claims.tenant,
        userId: claims.sub,
        scopes: claims.scopes,
      };
    },
  };
}
```

### One-Time WebSocket Ticket

```ts
import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";

export function oneTimeWsTicket(store: {
  consume(token: string): Promise<{ tenantId: string; userId: string } | null>;
}): AuthTicketPort {
  return {
    async verifyTicket(input) {
      if (input.channel !== "voice" || !input.token) return null;
      return store.consume(input.token);
    },
  };
}
```

### Custom Enterprise Session

```ts
import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";

export function enterpriseSessionAuth(sessionApi: {
  resolve(token: string): Promise<{
    accountId: string;
    userId: string;
    entitlements: string[];
  } | null>;
}): AuthTicketPort {
  return {
    async verifyTicket(input) {
      if (!input.token) return null;
      const session = await sessionApi.resolve(input.token);
      if (!session) return null;
      return {
        tenantId: session.accountId,
        userId: session.userId,
        scopes: session.entitlements,
      };
    },
  };
}
```

## Server Adapter

Fastify integration stays thin: your app resolves the trusted user context,
then the SDK handles browser voice streams.

```ts
import { createFastifyVoiceAdapter } from "@voiceagentsdk/core/server/adapters/fastify";

await app.register(createFastifyVoiceAdapter({
  routePrefix: "/api",
  resolveUser: async (request) => {
    const identity = await auth.verifyTicket({
      channel: "voice",
      token: String(request.query?.token ?? ""),
    });
    if (!identity) throw new Error("Unauthorized");
    return identity;
  },
  voice: voiceServiceConfig,
}));
```

## Pending Action Approval

Models cannot approve their own tool side effects. Sensitive tools create a
pending action, your app shows it in UI, then executes the stored action only
after server-side approval.

```ts
import type { PendingActionPort } from "@voiceagentsdk/core/sdk";

async function approvePendingAction(
  pendingActions: PendingActionPort,
  pendingId: string,
) {
  const pending = await pendingActions.get?.(pendingId);
  if (!pending || pending.status !== "confirmation_required") {
    throw new Error("Pending action is not approvable");
  }
  await pendingActions.resolve?.({ id: pending.id, status: "approved" });
  return runServerOwnedHandler(pending.toolName, pending.arguments);
}
```

## Secret Resolver

Secret lookup is also app-owned. The SDK receives named refs and never needs to
know which vault, KMS, or enterprise secret manager backs them.

```ts
import type { SecretResolverPort } from "@voiceagentsdk/core/sdk";

export function vaultSecretResolver(vault: {
  get(name: string): string | undefined;
}): SecretResolverPort {
  return {
    resolveSecret(input) {
      return vault.get(input.ref.name);
    },
  };
}
```

## Port Checklist

| Port | Production owner |
| --- | --- |
| `AuthTicketPort` | App auth/session layer |
| `TenantResolverPort` | App tenant routing |
| `SecretResolverPort` | App vault/KMS/secrets backend |
| `PromptCompilerPort` | App/starter compiled prompt source |
| `ProviderFactoryPort` | App provider credentials and model routing |
| `MemoryStorePort` | App runtime memory store |
| `PendingActionPort` | App approval UX and durable action store |
| `ActiveAgentAssignmentPort` | App tenant/user active-agent mapping |
| Store adapter contracts | App database adapter implementations |
