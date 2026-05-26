import { createAgentLogger } from "./logger.js";

export interface VoiceBenchmarkContext {
  experimentId?: string;
  sessionId: string;
  callSid?: string;
  model?: string;
  reasoningEffort?: string;
  welcomeMode?: string;
  promptVersion?: string;
  provider?: string;
}

export interface VoiceBenchmarkMarkData {
  [key: string]: unknown;
}

export class VoiceBenchmarkTrace {
  private readonly logger = createAgentLogger("VoiceBenchmark");
  private readonly startedAt = Date.now();
  private readonly seen = new Set<string>();

  constructor(private readonly context: VoiceBenchmarkContext) {}

  mark(event: string, data: VoiceBenchmarkMarkData = {}): void {
    if (!this.context.experimentId) return;
    this.logger.info("voice_benchmark_event", {
      ...this.context,
      event,
      elapsedMs: Date.now() - this.startedAt,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  markOnce(event: string, data: VoiceBenchmarkMarkData = {}): void {
    if (this.seen.has(event)) return;
    this.seen.add(event);
    this.mark(event, data);
  }
}

export function createVoiceBenchmarkTrace(
  context: VoiceBenchmarkContext,
): VoiceBenchmarkTrace {
  return new VoiceBenchmarkTrace(context);
}

export function sanitizeBenchmarkToolArgs(args: unknown): unknown {
  if (typeof args === "string") {
    try {
      return sanitizeBenchmarkToolArgs(JSON.parse(args));
    } catch {
      return { rawLength: args.length };
    }
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (/phone|email|token|secret|pin|password/i.test(key)) {
      sanitized[key] = "[redacted]";
    } else if (typeof value === "string") {
      sanitized[key] = value.length > 120 ? `${value.slice(0, 120)}...` : value;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
