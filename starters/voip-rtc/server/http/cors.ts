import type { StarterServerEnv } from "./types.js";
import {
  firstAllowedOrigin,
  isAllowedOrigin,
} from "./origins.js";

export function corsHeadersFor(
  env: StarterServerEnv,
  request: Request,
): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowOrigin = origin && isAllowedOrigin(env.allowedOrigins, origin)
    ? origin
    : firstAllowedOrigin(env.allowedOrigins);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization,Content-Type,X-Voice-Agent-Token",
    Vary: "Origin",
  };
}
