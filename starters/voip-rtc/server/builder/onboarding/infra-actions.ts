import { fileURLToPath } from "node:url";

export type OnboardingInfraAction = "plan" | "apply" | "status" | "destroy";

export interface OnboardingInfraRequest {
  driver?: string;
  target?: string;
  draftId?: string;
  intent?: string;
}

const starterRoot = fileURLToPath(new URL("../../../", import.meta.url));
const allowedActions = new Set(["plan", "apply", "status", "destroy"]);
const allowedDrivers = new Set(["dev-local", "k3s-docker", "kubectl"]);
const allowedTargets = new Set(["local", "k3s", "kubernetes", "vm"]);

export async function runOnboardingInfraAction(
  action: OnboardingInfraAction,
  input: OnboardingInfraRequest,
) {
  if (!allowedActions.has(action)) throw new Error(`Unsupported infra action: ${action}`);
  const args = ["run", "scripts/infra-apply.ts", action];
  if (input.driver) args.push(`--driver=${allowed(input.driver, allowedDrivers, "driver")}`);
  if (input.target) args.push(`--target=${allowed(input.target, allowedTargets, "target")}`);
  if (input.draftId) args.push(`--draft-id=${safeToken(input.draftId)}`);

  const result = await run(process.execPath, args, {
    BUILDER_INFRA_INTENT: input.intent?.trim() || undefined,
  });
  const parsed = parseJson(result.stdout) ?? parseJson(result.stderr);
  return {
    ok: result.exitCode === 0,
    action,
    command: `bun ${args.join(" ")}`,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed,
  };
}

async function run(
  command: string,
  args: string[],
  envOverrides: Record<string, string | undefined>,
) {
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...envOverrides }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const proc = Bun.spawn([command, ...args], {
    cwd: starterRoot,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

function allowed(value: string, allowedValues: Set<string>, label: string): string {
  if (!allowedValues.has(value)) throw new Error(`Unsupported ${label}: ${value}`);
  return value;
}

function safeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
}

function parseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
