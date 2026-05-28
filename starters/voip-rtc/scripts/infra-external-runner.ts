import type { InfraComputeTarget, InfraIacBundle } from "@voiceagentsdk/core/sdk";
import { join, resolve } from "node:path";

export type ExternalInfraAction = "plan" | "apply" | "status" | "destroy";

export interface ExternalInfraCommand {
  command: "tofu" | "cloud-init";
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface ExternalInfraCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExternalInfraRunnerInput {
  action: ExternalInfraAction;
  bundle: InfraIacBundle;
  outputDir: string;
  env?: Record<string, string | undefined>;
  execute?: (command: ExternalInfraCommand) => Promise<ExternalInfraCommandResult>;
}

export interface ExternalInfraRunnerResult {
  status: "planned" | "applied" | "ok";
  runner: "external";
  target: InfraComputeTarget;
  commands: Array<Pick<ExternalInfraCommand, "command" | "args" | "cwd">>;
}

export async function runExternalInfraRunner(
  input: ExternalInfraRunnerInput,
): Promise<ExternalInfraRunnerResult> {
  assertSupported(input);
  const commands = buildCommands(input);
  const execute = input.execute ?? executeCommand;

  for (const command of commands) {
    const result = await execute(command);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `${command.command} failed`);
    }
  }

  return {
    status: statusForAction(input.action),
    runner: "external",
    target: input.bundle.target,
    commands: commands.map(({ command, args, cwd }) => ({ command, args, cwd })),
  };
}

function assertSupported(input: ExternalInfraRunnerInput): void {
  if (input.action === "destroy") {
    throw new Error("External infra runner does not support destroy");
  }
  if (input.bundle.target === "local") {
    throw new Error("External infra runner cannot apply local targets");
  }
  if (!tofuModuleDir(input.env)) {
    throw new Error("BUILDER_INFRA_TOFU_MODULE_DIR is required for external runner");
  }
}

function buildCommands(input: ExternalInfraRunnerInput): ExternalInfraCommand[] {
  if (input.action === "status") return [tofuCommand(input, "plan")];
  const commands: ExternalInfraCommand[] = [];
  if (input.action === "apply" && input.bundle.target === "vm") {
    commands.push(cloudInitSchemaCommand(input));
  }
  commands.push(tofuCommand(input, "init"));
  commands.push(tofuCommand(input, input.action === "plan" ? "plan" : "apply"));
  return commands;
}

function tofuCommand(
  input: ExternalInfraRunnerInput,
  subcommand: "init" | "plan" | "apply",
): ExternalInfraCommand {
  const moduleDir = tofuModuleDir(input.env);
  if (!moduleDir) {
    throw new Error("BUILDER_INFRA_TOFU_MODULE_DIR is required for external runner");
  }
  const args = [`-chdir=${moduleDir}`, subcommand, "-input=false"];
  if (subcommand !== "init") args.push(`-var-file=${tofuVarsPath(input)}`);
  if (subcommand === "apply") args.push("-auto-approve");
  return command("tofu", args, moduleDir, input.env);
}

function cloudInitSchemaCommand(
  input: ExternalInfraRunnerInput,
): ExternalInfraCommand {
  return command(
    "cloud-init",
    ["schema", "--config-file", cloudInitPath(input)],
    input.outputDir,
    input.env,
  );
}

function command(
  executable: ExternalInfraCommand["command"],
  args: string[],
  cwd: string,
  env: ExternalInfraRunnerInput["env"],
): ExternalInfraCommand {
  return {
    command: executable,
    args,
    cwd,
    env: runnerEnv(env),
  };
}

function tofuVarsPath(input: ExternalInfraRunnerInput): string {
  const artifact = input.bundle.artifacts.find((item) =>
    item.dialect === "opentofu" && item.kind === "variables"
  );
  if (!artifact) throw new Error("OpenTofu variables artifact is required");
  return resolve(input.outputDir, artifact.path);
}

function cloudInitPath(input: ExternalInfraRunnerInput): string {
  const artifact = input.bundle.artifacts.find((item) =>
    item.dialect === "cloud-init" && item.kind === "bootstrap"
  );
  if (!artifact) throw new Error("cloud-init bootstrap artifact is required");
  return resolve(input.outputDir, artifact.path);
}

function tofuModuleDir(env: ExternalInfraRunnerInput["env"]): string | undefined {
  const value = env?.BUILDER_INFRA_TOFU_MODULE_DIR;
  return value ? resolve(value) : undefined;
}

function runnerEnv(
  env: ExternalInfraRunnerInput["env"],
): Record<string, string> {
  return Object.fromEntries(
    [
      ["HOME", env?.HOME],
      ["PATH", env?.PATH],
      ["TF_IN_AUTOMATION", "1"],
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function statusForAction(
  action: ExternalInfraAction,
): ExternalInfraRunnerResult["status"] {
  if (action === "apply") return "applied";
  if (action === "status") return "ok";
  return "planned";
}

async function executeCommand(
  command: ExternalInfraCommand,
): Promise<ExternalInfraCommandResult> {
  const proc = Bun.spawn([command.command, ...command.args], {
    cwd: command.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: command.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

export function externalApplyResultPath(outputDir: string): string {
  return join(outputDir, "external-apply-result.json");
}
