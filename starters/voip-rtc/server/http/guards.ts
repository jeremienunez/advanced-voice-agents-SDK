import type { StarterServerEnv } from "./types.js";
import { corsHeadersFor } from "./cors.js";
import { isAllowedOrigin } from "./origins.js";

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

export function accessGuard(
  env: StarterServerEnv,
  request: Request,
  url: URL,
): Response | null {
  if (!url.pathname.startsWith("/builder/") && url.pathname !== "/voice/ws") {
    return null;
  }
  if (isAuthorized(env, request, url)) return null;
  return new Response("Unauthorized", {
    status: 401,
    headers: corsHeadersFor(env, request),
  });
}

function isAuthorized(
  env: StarterServerEnv,
  request: Request,
  url: URL,
): boolean {
  if (!env.authToken) return true;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-voice-agent-token");
  const queryToken = url.searchParams.get("token");
  return [bearer, headerToken, queryToken].some((candidate) => {
    return candidate === env.authToken;
  });
}
