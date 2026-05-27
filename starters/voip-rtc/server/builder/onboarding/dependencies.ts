export type DependencyStatus = "ok" | "missing" | "blocked" | "optional";

export interface DependencyCheck {
  id: string;
  label: string;
  status: DependencyStatus;
  required: boolean;
  detail: string;
  command: string;
  docsUrl: string;
}

const docs = {
  docker: "https://docs.docker.com/get-started/get-docker/",
  kubectl: "https://kubernetes.io/docs/tasks/tools/",
  k3s: "https://docs.k3s.io/",
  terraform: "https://developer.hashicorp.com/terraform/install",
  opentofu: "https://opentofu.org/docs/intro/install/",
};

export async function checkOnboardingDependencies(): Promise<DependencyCheck[]> {
  const [dockerCli, dockerDaemon, kubectl, kubectlContext, terraform, opentofu] =
    await Promise.all([
      check("docker", ["--version"], "Docker CLI", false, docs.docker),
      check("docker", ["info", "--format", "{{.ServerVersion}}"], "Docker daemon", false, docs.docker),
      check("kubectl", ["version", "--client=true"], "kubectl CLI", false, docs.kubectl),
      check("kubectl", ["config", "current-context"], "Kubernetes context", false, docs.kubectl),
      check("terraform", ["version"], "Terraform CLI", false, docs.terraform),
      check("tofu", ["version"], "OpenTofu CLI", false, docs.opentofu),
    ]);

  return [
    dockerCli,
    dockerDaemon,
    kubectl,
    kubectlContext,
    terraform,
    opentofu,
    {
      id: "k3s-local",
      label: "Local K3s runtime",
      status: dockerCli.status === "ok" && dockerDaemon.status === "ok" ? "ok" : "optional",
      required: false,
      command: "pnpm run infra:apply",
      docsUrl: docs.k3s,
      detail:
        dockerCli.status === "ok" && dockerDaemon.status === "ok"
          ? "Optional K3s sandbox is available if you opt in."
          : "Optional: install Docker only if you want the K3s sandbox.",
    },
  ];
}

async function check(
  command: string,
  args: string[],
  label: string,
  required: boolean,
  docsUrl: string,
): Promise<DependencyCheck> {
  const result = await run(command, args, 5000);
  const status = result.ok ? "ok" : required ? classifyFailure(result) : "optional";
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    label,
    status,
    required,
    command: [command, ...args].join(" "),
    docsUrl,
    detail: result.ok
      ? compact(result.stdout || result.stderr)
      : compact(result.stderr || result.stdout || result.error || "Not available"),
  };
}

async function run(command: string, args: string[], timeoutMs: number) {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timer);
    return { ok: exitCode === 0, stdout, stderr, exitCode };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 127,
      error: error instanceof Error ? error.message : "command failed",
    };
  }
}

function classifyFailure(result: Awaited<ReturnType<typeof run>>): DependencyStatus {
  if (result.exitCode === 127 || /not found|ENOENT/i.test(result.error ?? "")) {
    return "missing";
  }
  return "blocked";
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
