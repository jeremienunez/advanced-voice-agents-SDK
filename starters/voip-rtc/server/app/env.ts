import {
  isLoopbackHost,
  resolveAllowedOrigins,
} from "../http/origins.js";
import type { StarterServerEnv } from "../http/types.js";
import { starterModeFromEnv } from "./starter-mode.js";

export function loadStarterServerEnv(): StarterServerEnv {
  const mode = starterModeFromEnv(Bun.env);
  const env = {
    allowedOrigins: resolveAllowedOrigins(),
    authToken: Bun.env.VOICE_DEV_AUTH_TOKEN,
    browserSampleRate: 24000,
    hostname: Bun.env.VOICE_SERVER_HOST ?? "127.0.0.1",
    isProduction: Bun.env.NODE_ENV === "production",
    mode,
    port: Number(Bun.env.VOICE_SERVER_PORT ?? 8787),
    publicHost: Bun.env.VOICE_PUBLIC_HOST ?? "127.0.0.1",
  };

  if ((env.isProduction || !isLoopbackHost(env.hostname)) && !env.authToken) {
    throw new Error(
      "VOICE_DEV_AUTH_TOKEN is required in production or when VOICE_SERVER_HOST is not loopback",
    );
  }

  return env;
}
