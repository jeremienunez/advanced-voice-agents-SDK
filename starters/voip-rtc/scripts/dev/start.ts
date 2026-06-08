import { loadStarterEnv } from "../tests/shared/env.js";

const root = new URL("../../../../", import.meta.url).pathname;
const cwd = new URL("../../", import.meta.url).pathname;
const env = await loadStarterEnv(import.meta.url);

async function runBuild(): Promise<void> {
  const proc = Bun.spawn(["pnpm", "build"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) process.exit(exitCode);
}

function spawn(name: string, command: string[]): Bun.Subprocess {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env,
  });
  console.log(`[${name}] ${command.join(" ")}`);
  return proc;
}

await runBuild();

const server = spawn("server", ["bun", "--watch", "server/index.ts"]);
const clientHost = env.VITE_DEV_HOST ?? "127.0.0.1";
const client = spawn("client", ["pnpm", "exec", "vite", "--host", clientHost]);

function shutdown(): void {
  server.kill();
  client.kill();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

await Promise.race([server.exited, client.exited]);
shutdown();
