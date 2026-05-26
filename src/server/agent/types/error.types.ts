/**
 * Error Types - Codes and base error class for agent system
 */

export const ERROR_CODES = {
  // Transport (1xxx)
  TRANSPORT_CONNECTION_FAILED: "TRANSPORT_1001",
  TRANSPORT_DISCONNECTED: "TRANSPORT_1003",
  TRANSPORT_SEND_FAILED: "TRANSPORT_1004",
  TRANSPORT_WEBSOCKET_ERROR: "TRANSPORT_1006",
  // OpenAI (2xxx)
  OPENAI_SESSION_FAILED: "OPENAI_2001",
  OPENAI_RESPONSE_ERROR: "OPENAI_2003",
  OPENAI_FUNCTION_ERROR: "OPENAI_2004",
  OPENAI_RATE_LIMIT: "OPENAI_2005",
  OPENAI_AUDIO_ERROR: "OPENAI_2008",
  // Twilio (3xxx)
  TWILIO_STREAM_ERROR: "TWILIO_3001",
  TWILIO_CALL_FAILED: "TWILIO_3002",
  TWILIO_SMS_FAILED: "TWILIO_3004",
  // Session (4xxx)
  SESSION_NOT_FOUND: "SESSION_4001",
  SESSION_EXPIRED: "SESSION_4003",
  SESSION_INVALID_STATE: "SESSION_4004",
  SESSION_AUTH_FAILED: "SESSION_4006",
  // Tool (5xxx)
  TOOL_NOT_FOUND: "TOOL_5001",
  TOOL_EXECUTION_FAILED: "TOOL_5002",
  TOOL_TIER_RESTRICTED: "TOOL_5004",
  TOOL_TIMEOUT: "TOOL_5006",
  // Database (6xxx)
  DB_CONNECTION_FAILED: "DB_6001",
  DB_QUERY_FAILED: "DB_6002",
  DB_NOT_FOUND: "DB_6003",
  // Redis (7xxx)
  REDIS_CONNECTION_FAILED: "REDIS_7001",
  REDIS_OPERATION_FAILED: "REDIS_7002",
  // Memory (9xxx)
  MEMORY_STORE_FAILED: "MEMORY_9001",
  MEMORY_RETRIEVE_FAILED: "MEMORY_9002",
  // Validation (10xxx)
  VALIDATION_FAILED: "VALIDATION_10001",
  // General
  RATE_LIMIT_EXCEEDED: "RATE_0429",
  INTERNAL_ERROR: "INTERNAL_99001",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface AgentErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: Error;
  context?: Record<string, unknown>;
  recoverable?: boolean;
  userMessage?: string;
}

export class AgentError extends Error {
  readonly code: ErrorCode;
  readonly context: Record<string, unknown>;
  readonly recoverable: boolean;
  readonly userMessage: string;
  readonly timestamp: number;
  override readonly cause?: Error;

  constructor(options: AgentErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AgentError";
    this.code = options.code;
    this.context = options.context ?? {};
    this.recoverable = options.recoverable ?? false;
    this.userMessage = options.userMessage ?? "Une erreur est survenue.";
    this.timestamp = Date.now();
    this.cause = options.cause;
    Object.setPrototypeOf(this, AgentError.prototype);
  }

  static from(
    error: unknown,
    code: ErrorCode,
    context?: Record<string, unknown>,
  ): AgentError {
    if (error instanceof AgentError) return error;
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "object" && error !== null) {
      // Prevent "[object Object]" — extract message or JSON-serialize
      const obj = error as Record<string, unknown>;
      message =
        typeof obj.message === "string" ? obj.message : JSON.stringify(error);
    } else {
      message = String(error);
    }
    const cause = error instanceof Error ? error : undefined;
    return new AgentError({ code, message, cause, context });
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
    };
  }
}
