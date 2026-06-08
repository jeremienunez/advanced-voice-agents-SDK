import { loadStarterEnv } from "../tests/shared/env.js";

const cwd = new URL("../../", import.meta.url).pathname;
const env = await loadStarterEnv(import.meta.url);

const server = Bun.spawn(["bun", "--watch", "server/index.ts"], {
  cwd,
  stdout: "inherit",
  stderr: "inherit",
  env,
});

function shutdown(): void {
  server.kill();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

process.exit(await server.exited);
