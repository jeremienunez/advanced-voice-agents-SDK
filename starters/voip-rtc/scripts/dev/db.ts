import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";

const containerName = "voiceagentsdk-voip-rtc-pgvector";
const volumeName = "voiceagentsdk-voip-rtc-pgdata";
const imageName = "pgvector/pgvector:pg16";
const envPath = new URL("../../.env.local", import.meta.url).pathname;
const dbName = "voiceagentsdk";
const dbUser = "voiceagentsdk";
const dbPassword = "voiceagentsdk_dev";

const command = process.argv[2] ?? "status";

switch (command) {
  case "start":
    await startDatabase();
    break;
  case "stop":
    await docker(["rm", "-f", containerName], { allowFailure: true });
    console.log(`Stopped ${containerName}`);
    break;
  case "status":
    await status();
    break;
  default:
    throw new Error(`Unknown db command "${command}". Use start, stop, or status.`);
}

async function startDatabase(): Promise<void> {
  const existing = await dockerOutput([
    "ps",
    "-a",
    "--filter",
    `name=^/${containerName}$`,
    "--format",
    "{{.Names}} {{.Status}} {{.Ports}}",
  ]);
  if (existing.trim()) {
    await docker(["start", containerName]);
  } else {
    const port = await findFreePort();
    await docker([
      "run",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_USER=${dbUser}`,
      "-e",
      `POSTGRES_PASSWORD=${dbPassword}`,
      "-e",
      `POSTGRES_DB=${dbName}`,
      "-v",
      `${volumeName}:/var/lib/postgresql/data`,
      "-p",
      `127.0.0.1:${port}:5432`,
      imageName,
    ]);
  }

  const port = await resolveHostPort();
  const databaseUrl = `postgres://${dbUser}:${dbPassword}@127.0.0.1:${port}/${dbName}`;
  await waitForPostgres(databaseUrl);
  writeEnvValue("DATABASE_URL", databaseUrl);
  console.log(`DATABASE_URL=${databaseUrl}`);
}

async function status(): Promise<void> {
  const output = await dockerOutput([
    "ps",
    "-a",
    "--filter",
    `name=^/${containerName}$`,
    "--format",
    "{{.Names}}\t{{.Status}}\t{{.Ports}}",
  ]);
  console.log(output.trim() || `${containerName} is not created`);
  if (output.trim()) {
    console.log(`DATABASE_URL=${readEnvValue("DATABASE_URL") ?? "not written"}`);
  }
}

async function waitForPostgres(databaseUrl: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    const proc = Bun.spawn(
      [
        "docker",
        "exec",
        containerName,
        "pg_isready",
        "-U",
        dbUser,
        "-d",
        dbName,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if ((await proc.exited) === 0) return;
    await Bun.sleep(500);
  }
  throw new Error(`Postgres did not become ready for ${databaseUrl}`);
}

async function resolveHostPort(): Promise<number> {
  const output = await dockerOutput(["port", containerName, "5432/tcp"]);
  const match = output.match(/127\.0\.0\.1:(\d+)/);
  if (!match) {
    throw new Error(`Could not resolve local Postgres port from: ${output}`);
  }
  return Number(match[1]);
}

async function findFreePort(): Promise<number> {
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

async function docker(args: string[], options?: { allowFailure?: boolean }) {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0 && !options?.allowFailure) {
    throw new Error(`docker ${args.join(" ")} failed with ${code}`);
  }
}

async function dockerOutput(args: string[]): Promise<string> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`docker ${args.join(" ")} failed: ${stderr}`);
  }
  return stdout;
}

function writeEnvValue(key: string, value: string): void {
  const lines = existsSync(envPath)
    ? readFileSync(envPath, "utf8").split(/\r?\n/)
    : [];
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = nextLine;
    writeFileSync(envPath, lines.join("\n").replace(/\n*$/, "\n"));
    return;
  }
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${nextLine}\n`);
    return;
  }
  appendFileSync(envPath, `${nextLine}\n`);
}

function readEnvValue(key: string): string | undefined {
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1);
  }
  return undefined;
}
