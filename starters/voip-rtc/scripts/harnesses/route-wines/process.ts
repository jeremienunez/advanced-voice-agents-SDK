import { appendFileSync } from "node:fs";
import { createServer } from "node:net";
import { compactEnv } from "./env.js";

export async function waitForHealth(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Retry until server is ready.
    }
    await Bun.sleep(250);
  }
  throw new Error(`Server did not become healthy: ${url}`);
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  commandEnv: Record<string, string | undefined>,
): Promise<void> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: compactEnv(commandEnv),
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${code}`);
  }
}

export async function pipeProcessOutput(
  proc: Bun.Subprocess,
  path: string,
): Promise<void> {
  await Promise.all([
    pipeReadableStream(proc.stdout, path),
    pipeReadableStream(proc.stderr, path),
  ]);
}

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address?.port) {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }
      server.close(() => reject(new Error("Unable to allocate a free port")));
    });
    server.on("error", reject);
  });
}

async function pipeReadableStream(
  stream: ReadableStream<Uint8Array> | number | null | undefined,
  path: string,
): Promise<void> {
  if (!stream || typeof stream === "number") return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) appendFileSync(path, decoder.decode(value, { stream: true }));
    }
    const remaining = decoder.decode();
    if (remaining) appendFileSync(path, remaining);
  } finally {
    reader.releaseLock();
  }
}
