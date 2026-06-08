import { createAgentLogger } from "../../../src/server/agent/utils/logger.js";

const results = [
  scenarioConsoleLoggerRedactsContentAndSecretsRecursively(),
  scenarioPinoChildLoggerRedactsBindingsBeforeDelegating(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioConsoleLoggerRedactsContentAndSecretsRecursively(): string {
  const bearerSecret = ["Bearer sk", "secret", "log", "token"].join("-");
  const lines = captureConsole(() => {
    const logger = createAgentLogger().child({
      sessionId: "session_log_redaction",
      prompt: "SYSTEM PROMPT MUST NOT LEAK",
      nested: {
        message: "PRIVATE USER MESSAGE MUST NOT LEAK",
        headers: { authorization: bearerSecret },
      },
    });

    logger.info("safe log label", {
      requestId: "request-123",
      messageCount: 2,
      payload: {
        content: "PRIVATE ASSISTANT CONTENT MUST NOT LEAK",
        promptTokens: 42,
      },
    });
  });

  const output = lines.join("\n");

  assertNoLeak(output, [
    "SYSTEM PROMPT MUST NOT LEAK",
    "PRIVATE USER MESSAGE MUST NOT LEAK",
    "PRIVATE ASSISTANT CONTENT MUST NOT LEAK",
    bearerSecret,
  ]);
  assert(output.includes("request-123"), "safe request id must remain logged");
  assert(output.includes("messageCount"), "safe message count metric must remain logged");
  assert(output.includes("promptTokens"), "safe prompt token metric must remain logged");

  return "console-logger-recursive-content-redaction";
}

function scenarioPinoChildLoggerRedactsBindingsBeforeDelegating(): string {
  const pino = new RecordingPino();
  const logger = createAgentLogger(pino).child({
    userId: "user-123",
    message: "PINNED CHILD MESSAGE MUST NOT LEAK",
    headers: { authorization: "Bearer child-secret" },
  });

  logger.info("child log", {
    prompt: "PINNED INFO PROMPT MUST NOT LEAK",
    requestId: "request-456",
  });

  const output = JSON.stringify({
    children: pino.children,
    entries: pino.entries,
  });

  assertNoLeak(output, [
    "PINNED CHILD MESSAGE MUST NOT LEAK",
    "PINNED INFO PROMPT MUST NOT LEAK",
    "child-secret",
  ]);
  assert(output.includes("user-123"), "safe child user id must remain logged");
  assert(output.includes("request-456"), "safe pino context must remain logged");

  return "pino-child-bindings-redacted";
}

function captureConsole(run: () => void): string[] {
  const originalLog = console.log;
  const originalNodeEnv = process.env.NODE_ENV;
  const lines: string[] = [];

  process.env.NODE_ENV = "development";
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    run();
  } finally {
    console.log = originalLog;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }

  return lines;
}

class RecordingPino {
  readonly children: Array<Record<string, unknown>> = [];
  readonly entries: Array<Record<string, unknown>> = [];

  child(bindings: Record<string, unknown>): RecordingPino {
    this.children.push(bindings);
    return this;
  }

  debug(ctx: Record<string, unknown>, msg: string): void {
    this.record("debug", ctx, msg);
  }

  info(ctx: Record<string, unknown>, msg: string): void {
    this.record("info", ctx, msg);
  }

  warn(ctx: Record<string, unknown>, msg: string): void {
    this.record("warn", ctx, msg);
  }

  error(ctx: Record<string, unknown>, msg: string): void {
    this.record("error", ctx, msg);
  }

  private record(
    level: string,
    ctx: Record<string, unknown>,
    msg: string,
  ): void {
    this.entries.push({ level, ctx, msg });
  }
}

function assertNoLeak(output: string, forbiddenValues: string[]): void {
  for (const value of forbiddenValues) {
    assert(!output.includes(value), `log output leaked sensitive value: ${value}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
