import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AgentLogger,
  LogContext,
} from "../../../src/server/agent/utils/logger.js";
import {
  createOpenAIDebugAudioDump,
} from "../../../src/server/agent/transports/openai-realtime/debug-audio.js";

try {
  const results = [
    scenarioDebugAudioRequiresExplicitLocalMode(),
    scenarioLocalDebugWritesRestrictedArtifactsAndCleansUp(),
  ];

  console.log(JSON.stringify({ status: "ok", results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: "error",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}

function scenarioDebugAudioRequiresExplicitLocalMode(): string {
  const root = mkdtempSync(join(tmpdir(), "voice-debug-off-"));
  const logger = new RecordingLogger();

  try {
    withEnv({
      NODE_ENV: "development",
      VOICE_DEBUG_AUDIO: "true",
      VOICE_DEBUG_AUDIO_DIR: root,
    }, () => {
      const dump = createOpenAIDebugAudioDump(logger);

      assert(dump === null, "debug audio must require VOICE_DEBUG_AUDIO=local");
      assert(
        readdirSync(root).length === 0,
        "non-local debug mode must not create audio artifacts",
      );
    });
  } finally {
    logger.cleanupObservedDebugDirectory();
    rmSync(root, { recursive: true, force: true });
  }

  return "debug-audio-requires-explicit-local-mode";
}

function scenarioLocalDebugWritesRestrictedArtifactsAndCleansUp(): string {
  const root = mkdtempSync(join(tmpdir(), "voice-debug-local-"));
  const logger = new RecordingLogger();

  try {
    withEnv({
      NODE_ENV: "development",
      VOICE_DEBUG_AUDIO: "local",
      VOICE_DEBUG_AUDIO_DIR: root,
    }, () => {
      const dump = createOpenAIDebugAudioDump(logger);

      assert(dump !== null, "local debug audio mode must create a dump");
      assert(
        dump.directory.startsWith(root),
        "debug dump must stay in local root",
      );
      assertMode(dump.directory, 0o700, "debug directory");

      dump.appendInput(Buffer.from([1, 0, 2, 0]));
      dump.appendOutput(Buffer.from([3, 0, 4, 0]));
      assertMode(dump.inputPath, 0o600, "input pcm");
      assertMode(dump.outputPath, 0o600, "output pcm");

      dump.finalize();
      assert(existsSync(dump.inputWavPath), "input wav must be written");
      assert(existsSync(dump.outputWavPath), "output wav must be written");
      assertMode(dump.inputWavPath, 0o600, "input wav");
      assertMode(dump.outputWavPath, 0o600, "output wav");

      dump.cleanup();
      assert(!existsSync(dump.directory), "cleanup must remove debug artifacts");
    });
  } finally {
    logger.cleanupObservedDebugDirectory();
    rmSync(root, { recursive: true, force: true });
  }

  return "debug-audio-local-permissions-and-cleanup";
}

class RecordingLogger implements AgentLogger {
  readonly entries: Array<{ message: string; ctx?: LogContext }> = [];

  debug(msg: string, ctx?: LogContext): void {
    this.record(msg, ctx);
  }

  info(msg: string, ctx?: LogContext): void {
    this.record(msg, ctx);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.record(msg, ctx);
  }

  error(msg: string, _error?: unknown, ctx?: LogContext): void {
    this.record(msg, ctx);
  }

  child(_ctx: LogContext): AgentLogger {
    return this;
  }

  cleanupObservedDebugDirectory(): void {
    for (const directory of this.observedDebugDirectories()) {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  private record(message: string, ctx?: LogContext): void {
    this.entries.push({ message, ctx });
  }

  private observedDebugDirectories(): string[] {
    return this.entries
      .map((entry) => entry.ctx?.debugDirectory ?? entry.message)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.match(/\/tmp\/voice-debug\/[A-Za-z0-9T_-]+/)?.[0])
      .filter((value): value is string => Boolean(value));
  }
}

function withEnv(vars: Record<string, string>, run: () => void): void {
  const previous = new Map(
    Object.keys(vars).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function assertMode(path: string, expected: number, label: string): void {
  const actual = statSync(path).mode & 0o777;
  assert(
    actual === expected,
    `${label} mode must be ${expected.toString(8)}, got ${actual.toString(8)}`,
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
