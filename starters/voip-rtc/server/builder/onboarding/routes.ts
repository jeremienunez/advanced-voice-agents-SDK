import { checkOnboardingDependencies } from "./dependencies.js";
import {
  readOnboardingEnvStore,
  writeOnboardingEnvStore,
} from "./env-store.js";
import {
  runOnboardingInfraAction,
  type OnboardingInfraAction,
  type OnboardingInfraRequest,
} from "./infra-actions.js";

export interface OnboardingRouteResult {
  status: number;
  body: unknown;
}

export async function routeOnboardingRequest(
  request: Request,
  url: URL,
): Promise<OnboardingRouteResult | null> {
  if (url.pathname === "/builder/onboarding" && request.method === "GET") {
    return {
      status: 200,
      body: {
        env: readOnboardingEnvStore(),
        dependencies: await checkOnboardingDependencies(),
      },
    };
  }

  if (url.pathname === "/builder/onboarding/env" && request.method === "POST") {
    const body = await request.json() as { values?: Record<string, unknown> };
    return {
      status: 200,
      body: {
        env: writeOnboardingEnvStore(body.values ?? {}),
        dependencies: await checkOnboardingDependencies(),
      },
    };
  }

  const action = actionFromPath(url.pathname);
  if (action && request.method === "POST") {
    const body = await safeJson<OnboardingInfraRequest>(request);
    const result = await runOnboardingInfraAction(action, body ?? {});
    return {
      status: result.ok ? 200 : 500,
      body: { infra: result },
    };
  }

  return null;
}

function actionFromPath(pathname: string): OnboardingInfraAction | null {
  const prefix = "/builder/onboarding/infra/";
  if (!pathname.startsWith(prefix)) return null;
  const action = pathname.slice(prefix.length);
  return ["plan", "apply", "status", "destroy"].includes(action)
    ? action as OnboardingInfraAction
    : null;
}

async function safeJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
