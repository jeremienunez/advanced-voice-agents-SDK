import type {
  EventSinkPort,
  LoggerPort,
  RuntimeEventRecord,
} from "../../sdk/types.js";
import { createConsoleLoggerPort } from "./logger-port.js";

export const noopEventSink: EventSinkPort = {
  emit: () => {},
};

export function createConsoleEventSink<TEvent extends RuntimeEventRecord>(
  logger: LoggerPort = createConsoleLoggerPort({ component: "EventSink" }),
): EventSinkPort<TEvent> {
  return {
    emit(event) {
      logger.info("browser voice event", {
        type: event.type,
        event,
      });
    },
  };
}
