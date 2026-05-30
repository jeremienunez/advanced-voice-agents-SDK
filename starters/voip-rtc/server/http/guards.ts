import type {
  AuthTicketIdentity,
  AuthTicketPort,
} from "@voiceagentsdk/core/sdk";
import { authTicketInputFromRequest } from "../auth/ticket-input.js";
import type { StarterServerEnv } from "./types.js";
import { corsHeadersFor } from "./cors.js";
import { isAllowedOrigin } from "./origins.js";

export interface AccessGuardResult {
  identity?: AuthTicketIdentity;
  response?: Response;
}

export function originGuard(
  env: StarterServerEnv,
  request: Request,
): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || isAllowedOrigin(env.allowedOrigins, origin)) return null;
  return new Response("Origin not allowed", {
    status: 403,
    headers: corsHeadersFor(env, request),
  });
}

export async function accessGuard(
  env: StarterServerEnv,
  verifier: AuthTicketPort,
  request: Request,
  url: URL,
): Promise<AccessGuardResult> {
  if (!url.pathname.startsWith("/builder/") && url.pathname !== "/voice/ws") {
    return {};
  }
  const modeFailure = productionModeFallbackGuard(env, request, url);
  if (modeFailure) return { response: modeFailure };
  const identity = await verifier.verifyTicket(
    authTicketInputFromRequest(request, url),
  );
  if (identity) return { identity };
  return {
    response: new Response("Unauthorized", {
      status: 401,
      headers: corsHeadersFor(env, request),
    }),
  };
}

function productionModeFallbackGuard(
  env: StarterServerEnv,
  request: Request,
  url: URL,
): Response | null {
  if (env.mode !== "production") return null;
  const queryIdentity = ["tenantId", "userId", "planId"].filter((key) =>
    url.searchParams.has(key)
  );
  if (queryIdentity.length > 0) {
    return new Response(
      `Requested query identity (${queryIdentity.join(", ")}) is local-only and refused in production mode`,
      { status: 400, headers: corsHeadersFor(env, request) },
    );
  }
  if (url.searchParams.has("token")) {
    return new Response(
      "Query auth token is local-only and refused in production mode",
      { status: 400, headers: corsHeadersFor(env, request) },
    );
  }
  return null;
}
