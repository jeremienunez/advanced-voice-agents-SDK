import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type InfraApplyDriver = "dev-local" | "k3s-docker" | "kubectl";

export interface K3sDockerConfig {
  containerName: string;
  image: string;
  port: string;
  stateRoot: string;
}

export async function ensureLocalK3s(config: K3sDockerConfig): Promise<string> {
  await requireCommand("docker");
  await requireCommand("kubectl");
  const k3sDir = join(config.stateRoot, "k3s");
  const kubeconfig = join(k3sDir, "kubeconfig.yaml");
  const inspected = await runOptional("docker", ["inspect", config.containerName]);
  if (!inspected.ok) {
    await run("docker", [
      "run", "-d", "--name", config.containerName,
      "--hostname", config.containerName, "--privileged",
      "-p", `127.0.0.1:${config.port}:6443`,
      "-e", "K3S_KUBECONFIG_OUTPUT=/output/kubeconfig.yaml",
      "-e", "K3S_KUBECONFIG_MODE=666",
      "-v", `${k3sDir}:/output`, config.image, "server",
      "--tls-san", "127.0.0.1", "--disable", "traefik",
    ]);
  } else {
    const running = await run("docker", [
      "inspect", "-f", "{{.State.Running}}", config.containerName,
    ]);
    if (running.stdout.trim() !== "true") {
      await run("docker", ["start", config.containerName]);
    }
  }
  await waitForFile(kubeconfig, 120_000);
  rewriteKubeconfigPort(kubeconfig, config.port);
  await waitForKubectl(kubeconfig, 120_000);
  return kubeconfig;
}

export async function ensureKubectlContext(): Promise<string | undefined> {
  await requireCommand("kubectl");
  await run("kubectl", ["config", "current-context"]);
  await run("kubectl", ["cluster-info"]);
  return undefined;
}

export async function applyKubernetesArtifacts(
  paths: string[],
  kubeconfig: string | undefined,
): Promise<void> {
  const manifests = paths.filter((path) => path.endsWith(".yaml"));
  if (manifests.length === 0) fail("No Kubernetes YAML artifacts to apply.");
  for (const manifest of manifests) {
    await kubectl(kubeconfig, ["apply", "-f", manifest]);
  }
}

export async function verifyApply(
  namespace: string,
  kubeconfig: string | undefined,
): Promise<void> {
  await kubectl(kubeconfig, ["get", "namespace", namespace, "-o", "name"]);
  await kubectl(kubeconfig, [
    "-n", namespace, "get", "configmap", "voice-agent-infra-plan", "-o", "name",
  ]);
  await kubectl(kubeconfig, [
    "-n", namespace, "get", "networkpolicy",
    "voice-agent-private-default", "-o", "name",
  ]);
}

export async function destroyLocalK3s(config: K3sDockerConfig): Promise<void> {
  await requireCommand("docker");
  const inspected = await runOptional("docker", ["inspect", config.containerName]);
  if (inspected.ok) await run("docker", ["rm", "-f", config.containerName]);
}

async function kubectl(kubeconfig: string | undefined, args: string[]) {
  return run("kubectl", kubeconfig ? ["--kubeconfig", kubeconfig, ...args] : args);
}

async function waitForKubectl(kubeconfig: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await runOptional("kubectl", [
      "--kubeconfig", kubeconfig, "get", "nodes",
    ]);
    if (ready.ok) return;
    await sleep(1500);
  }
  fail("Timed out waiting for local K3s kubectl readiness.");
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(path)) return;
    await sleep(1000);
  }
  fail(`Timed out waiting for ${path}`);
}

function rewriteKubeconfigPort(path: string, port: string): void {
  const text = readFileSync(path, "utf8")
    .replace(/https:\/\/127\.0\.0\.1:6443/g, `https://127.0.0.1:${port}`)
    .replace(/https:\/\/0\.0\.0\.0:6443/g, `https://127.0.0.1:${port}`);
  writeFileSync(path, text);
}

async function requireCommand(command: string): Promise<void> {
  const args = command === "kubectl" ? ["version", "--client=true"] : ["--version"];
  const result = await runOptional(command, args);
  if (!result.ok) fail(`Missing or unavailable command: ${command}`);
}

async function run(command: string, args: string[]) {
  const result = await runOptional(command, args);
  if (!result.ok) fail(result.stderr || `${command} failed`);
  return result;
}

async function runOptional(command: string, args: string[]) {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { ok: exitCode === 0, stdout, stderr, exitCode };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
