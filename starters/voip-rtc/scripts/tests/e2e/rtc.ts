import { createServer } from "node:net";
import { loadStarterEnv } from "../shared/env.js";

type JsonRecord = Record<string, unknown>;

const starterRoot = new URL("../../../", import.meta.url).pathname;
const env = await loadStarterEnv(import.meta.url);

const timeoutMs = readNumber(env.RTC_E2E_TIMEOUT_MS, 30_000);
const durationMs = readNumber(env.RTC_E2E_AUDIO_DURATION_MS, 1200);
let managedServer: Bun.Subprocess | null = null;

const serverUrl = env.RTC_E2E_SERVER_URL ?? (await startManagedServer());

const session = await getJson(`${serverUrl}/builder/session`);
const activeDraftId = readString(session, "activeDraftId");
if (!activeDraftId) fail("No active compiled builder session");
if (!asRecord(session.artifact).draftId) {
  fail(`Active draft has no compiled artifact: ${activeDraftId}`);
}
const initialVersion = readRecordNumber(
  asRecord(asRecord(session.draft).evolution),
  "version",
) ?? 1;

const config = await getJson(`${serverUrl}/config`);
const wsUrl = readString(config, "wsUrl").replace("localhost", "127.0.0.1");
const providers = readArray(config.providers).map(asRecord);
const provider =
  providers.find((item) => item.id === "gemini" && item.enabled === true) ??
  providers.find((item) => item.enabled === true);
if (!provider) fail("No enabled realtime provider in /config");

const model = readString(provider, "defaultModel");
const voice = readString(provider, "defaultVoice");
const events: JsonRecord[] = [];
let audioTimer: ReturnType<typeof setInterval> | null = null;

await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error(`RTC E2E timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  const ws = new WebSocket(wsUrl);
  let sessionEnded = false;
  let terminalLearning = false;
  let finished = false;

  function finish(error?: Error): void {
    if (finished) return;
    finished = true;
    if (audioTimer) clearInterval(audioTimer);
    clearTimeout(timeout);
    ws.close();
    if (error) reject(error);
    else resolve();
  }

  async function finishAfterLearning(): Promise<void> {
    if (!sessionEnded || !terminalLearning) return;
    const health = await getJson(`${serverUrl}/health`);
    const activeSessions = readRecordNumber(health, "activeSessions");
    if (activeSessions !== 0) {
      finish(new Error(`Expected activeSessions 0, got ${activeSessions}`));
      return;
    }
    const nextSession = await getJson(`${serverUrl}/builder/session`);
    const nextVersion = readRecordNumber(
      asRecord(asRecord(nextSession.draft).evolution),
      "version",
    ) ?? 0;
    if (nextVersion <= initialVersion) {
      finish(
        new Error(
          `Expected learned agent version > ${initialVersion}, got ${nextVersion}`,
        ),
      );
      return;
    }
    finish();
  }

  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        type: "session.start",
        provider: readString(provider, "id"),
        model,
        voice,
        agent: activeDraftId,
      }),
    );
  });

  ws.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    const message = JSON.parse(event.data) as JsonRecord;
    events.push(message);

    if (message.type === "session.started") {
      audioTimer = setInterval(() => {
        ws.send(new ArrayBuffer(960 * 2));
      }, 40);
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "session.end" }));
      }, durationMs);
    }

    if (message.type === "session.ended") {
      sessionEnded = true;
      void finishAfterLearning().catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error(String(error)));
      });
    }

    if (message.type === "learning.status") {
      const learning = asRecord(message.learning);
      const status = readString(learning, "status");
      if (status === "failed") {
        finish(new Error(readString(learning, "error") || JSON.stringify(learning)));
        return;
      }
      if (status === "skipped") {
        finish(new Error(readString(learning, "message") || "Learning was skipped"));
        return;
      }
      if (status === "applied") {
        terminalLearning = true;
        void finishAfterLearning().catch((error: unknown) => {
          finish(error instanceof Error ? error : new Error(String(error)));
        });
      }
    }

    if (message.type === "session.error") {
      finish(new Error(JSON.stringify(message.error ?? message)));
    }
  });

  ws.addEventListener("error", () => {
    finish(new Error("WebSocket error"));
  });
});

const started = events.find((event) => event.type === "session.started");
const ended = events.find((event) => event.type === "session.ended");
const learning = events.find((event) => event.type === "learning.status");
const stateChanges = events.filter((event) => event.type === "state.change");
const learningStatuses = learningStatusValues(events);

assert(started, "session.started was not received");
assert(ended, "session.ended was not received");
assert(learning, "learning.status was not received");
assert(learningStatuses.includes("evaluated"), "learning.status evaluated was not received");
assert(
  learningStatuses.some((status) => status === "applied" || status === "pending_approval"),
  "learning terminal status was not received",
);
assert(
  stateChanges.some((event) => event.state === "listening"),
  "listening state was not received",
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      serverUrl,
      wsUrl,
      activeDraftId,
      provider: readString(provider, "id"),
      model,
      voice,
      eventTypes: events.map((event) => event.type),
      learningStatuses,
      sessionId: readString(started, "sessionId"),
      initialVersion,
      learnedVersion: readRecordNumber(
        asRecord(asRecord(await getJson(`${serverUrl}/builder/session`)).draft)
          .evolution,
        "version",
      ),
    },
    null,
    2,
  ),
);

stopManagedServer();

async function startManagedServer(): Promise<string> {
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}`;
  managedServer = Bun.spawn(["bun", "server/index.ts"], {
    cwd: starterRoot,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...env,
      AGENT_LEARNING_PROFILE: "auto_apply_prompt_safe",
      RTC_E2E_FAKE_PROVIDER: "1",
      VOICE_SERVER_PORT: String(port),
    },
  });

  await Promise.race([
    waitForHealth(url),
    managedServer.exited.then((code) => {
      throw new Error(`Managed RTC server exited before healthcheck: ${code}`);
    }),
  ]);
  return url;
}

function stopManagedServer(): void {
  managedServer?.kill();
  managedServer = null;
}

async function waitForHealth(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Retry until the isolated server is ready.
    }
    await Bun.sleep(250);
  }
  throw new Error(`Server did not become healthy: ${url}`);
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

async function getJson(url: string): Promise<JsonRecord> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `${url} failed with ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as JsonRecord;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRecordNumber(value: unknown, key: string): number | undefined {
  const item = asRecord(value)[key];
  return typeof item === "number" && Number.isFinite(item) ? item : undefined;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function readString(value: unknown, key: string): string {
  const item = asRecord(value)[key];
  return typeof item === "string" ? item : "";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function learningStatusValues(events: JsonRecord[]): string[] {
  return events
    .filter((event) => event.type === "learning.status")
    .map((event) => readString(asRecord(event.learning), "status"));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function fail(message: string): never {
  stopManagedServer();
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
