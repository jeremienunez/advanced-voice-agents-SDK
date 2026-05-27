import type { AuthTicketInput } from "@voiceagentsdk/core/sdk";

export function authTicketInputFromRequest(
  request: Request,
  url: URL,
): AuthTicketInput {
  return {
    channel: url.pathname === "/voice/ws" ? "voice" : "builder",
    origin: request.headers.get("origin") ?? undefined,
    requestedTenantId: url.searchParams.get("tenantId") ?? undefined,
    requestedUserId: url.searchParams.get("userId") ?? undefined,
    requestedPlanId: url.searchParams.get("planId") ?? undefined,
    token: authTokenFromRequest(request, url),
    metadata: {
      path: url.pathname,
      method: request.method,
    },
  };
}

function authTokenFromRequest(
  request: Request,
  url: URL,
): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ??
    request.headers.get("x-voice-agent-token") ??
    url.searchParams.get("token") ??
    undefined;
}
