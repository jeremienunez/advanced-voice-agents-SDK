export interface RuntimeEventRecord {
  type: string;
  timestamp?: number;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EventSinkPort<TEvent = RuntimeEventRecord> {
  emit(event: TEvent): void | Promise<void>;
}

export type RuntimeLogContext = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, context?: RuntimeLogContext): void;
  info(message: string, context?: RuntimeLogContext): void;
  warn(message: string, context?: RuntimeLogContext): void;
  error(message: string, context?: RuntimeLogContext): void;
  child(context: RuntimeLogContext): LoggerPort;
}
