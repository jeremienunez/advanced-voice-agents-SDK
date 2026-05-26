/**
 * Agent Logger - Simplified wrapper for structured logging
 * Delegates to Pino (production) or console (development).
 * Provides context binding for sessionId, userId, channel.
 */

/**
 * Log context for agent operations
 */
export interface LogContext {
  sessionId?: string;
  userId?: string;
  channel?: "voice" | "sms" | "browser";
  [key: string]: unknown;
}

/**
 * Agent logger interface
 */
export interface AgentLogger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, error?: Error | unknown, ctx?: LogContext): void;
  child(ctx: LogContext): AgentLogger;
}

/**
 * Fields to redact from logs
 */
const REDACT_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "authorization",
  "pin",
];

/**
 * Redact sensitive fields from context
 */
function redactContext(ctx: LogContext): LogContext {
  const redacted: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (REDACT_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Check if in production environment
 */
function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Console-based logger implementation
 */
class ConsoleAgentLogger implements AgentLogger {
  constructor(private readonly context: LogContext = {}) {}

  private log(level: string, msg: string, ctx?: LogContext): void {
    const mergedCtx = redactContext({ ...this.context, ...ctx });
    const hasContext = Object.keys(mergedCtx).length > 0;

    if (isProd()) {
      // JSON output for production
      console.log(
        JSON.stringify({
          level,
          msg,
          time: new Date().toISOString(),
          ...(hasContext && mergedCtx),
        }),
      );
    } else {
      // Pretty output for development
      const prefix = `[${level.toUpperCase()}]`;
      const contextStr = hasContext ? ` ${JSON.stringify(mergedCtx)}` : "";
      console.log(`${prefix} ${msg}${contextStr}`);
    }
  }

  debug(msg: string, ctx?: LogContext): void {
    this.log("debug", msg, ctx);
  }

  info(msg: string, ctx?: LogContext): void {
    this.log("info", msg, ctx);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.log("warn", msg, ctx);
  }

  error(msg: string, error?: Error | unknown, ctx?: LogContext): void {
    const errorInfo =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message }
        : error && typeof error === "object"
          ? { errorMessage: JSON.stringify(error) }
          : error
            ? { errorMessage: String(error) }
            : {};
    this.log("error", msg, { ...ctx, ...errorInfo });
  }

  child(ctx: LogContext): AgentLogger {
    return new ConsoleAgentLogger({ ...this.context, ...ctx });
  }
}

/**
 * Pino-based logger wrapper
 */
interface PinoLike {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => PinoLike;
}

class PinoAgentLogger implements AgentLogger {
  constructor(
    private readonly pino: PinoLike,
    private readonly context: LogContext = {},
  ) {}

  debug(msg: string, ctx?: LogContext): void {
    this.pino.debug(redactContext({ ...this.context, ...ctx }), msg);
  }

  info(msg: string, ctx?: LogContext): void {
    this.pino.info(redactContext({ ...this.context, ...ctx }), msg);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.pino.warn(redactContext({ ...this.context, ...ctx }), msg);
  }

  error(msg: string, error?: Error | unknown, ctx?: LogContext): void {
    const context = redactContext({ ...this.context, ...ctx });
    if (error instanceof Error) {
      this.pino.error({ ...context, err: error }, msg);
    } else {
      this.pino.error(context, msg);
    }
  }

  child(ctx: LogContext): AgentLogger {
    return new PinoAgentLogger(this.pino.child(ctx), {
      ...this.context,
      ...ctx,
    });
  }
}

/**
 * Create an agent logger
 * @param baseLogger Optional Pino logger instance (from Fastify)
 */
export function createAgentLogger(baseLogger?: unknown): AgentLogger {
  // Check if baseLogger looks like a Pino logger
  if (baseLogger && typeof baseLogger === "object" && "child" in baseLogger) {
    return new PinoAgentLogger(baseLogger as PinoAgentLogger["pino"]);
  }
  return new ConsoleAgentLogger();
}
