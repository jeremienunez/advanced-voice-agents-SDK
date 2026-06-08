import type { ServerVoiceMessage } from "../../../sdk/types/browser-voice.js";
import type {
  EventSinkPort,
  LoggerPort,
} from "../../../sdk/types.js";
import { noopEventSink } from "../../observability/event-sink.js";
import { WS_OPEN } from "./protocol-constants.js";
import type { BrowserVoiceSocket } from "./types.js";

export interface BrowserControlEmitter {
  emit(socket: BrowserVoiceSocket, message: ServerVoiceMessage): void;
}

export function createBrowserControlEmitter(options: {
  eventSink?: EventSinkPort<ServerVoiceMessage>;
  logger: LoggerPort;
}): BrowserControlEmitter {
  const eventSink = options.eventSink ?? noopEventSink;
  return {
    emit(socket, message) {
      emitToSink(eventSink, options.logger, message);
      if (socket.readyState === WS_OPEN) socket.send(JSON.stringify(message));
    },
  };
}

function emitToSink(
  eventSink: EventSinkPort<ServerVoiceMessage>,
  logger: LoggerPort,
  message: ServerVoiceMessage,
): void {
  try {
    void Promise.resolve(eventSink.emit(message)).catch((error) => {
      logger.error("Browser voice event sink failed", { error });
    });
  } catch (error) {
    logger.error("Browser voice event sink failed", { error });
  }
}
