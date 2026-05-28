import type {
  LoggerPort,
  RuntimeLogContext,
} from "../../sdk/types.js";
import { redactLogContext } from "../agent/utils/log-redaction.js";

export const noopLogger: LoggerPort = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

export function createConsoleLoggerPort(
  context: RuntimeLogContext = {},
): LoggerPort {
  return new ConsoleLoggerPort(context);
}

class ConsoleLoggerPort implements LoggerPort {
  constructor(private readonly context: RuntimeLogContext) {}

  debug(message: string, context?: RuntimeLogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: RuntimeLogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: RuntimeLogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: RuntimeLogContext): void {
    this.log("error", message, context);
  }

  child(context: RuntimeLogContext): LoggerPort {
    return new ConsoleLoggerPort({
      ...this.context,
      ...redactLogContext(context),
    });
  }

  private log(
    level: string,
    message: string,
    context?: RuntimeLogContext,
  ): void {
    const redacted = redactLogContext({ ...this.context, ...context });
    const contextText = Object.keys(redacted).length
      ? ` ${JSON.stringify(redacted)}`
      : "";
    console.log(`[${level.toUpperCase()}] ${message}${contextText}`);
  }
}
