import WebSocket, { RawData } from "ws";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import type {
  AudioChunk,
  IVoiceTransport,
  TransportMessage,
  TransportState,
} from "../../types/transport.types.js";
import type {
  TwilioConnectedMessage,
  TwilioDtmfMessage,
  TwilioMarkMessage,
  TwilioMediaMessage,
  TwilioStartMessage,
  TwilioStopMessage,
  TwilioStreamMessage,
} from "../../types/twilio.types.js";
import type {
  TwilioVoiceConfig,
  TwilioVoiceEventHandlers,
} from "./types.js";

export class TwilioVoiceTransport implements IVoiceTransport {
  readonly id: string;
  readonly type = "twilio-voice" as const;

  private ws: WebSocket | null = null;
  private _state: TransportState = "disconnected";
  private _streamSid: string | null = null;
  private _callSid: string | null = null;
  private audioSequence = 0;
  private pendingMarks = new Map<
    string,
    { resolve: () => void; timeout: NodeJS.Timeout }
  >();

  constructor(
    private config: TwilioVoiceConfig = {},
    private readonly handlers: TwilioVoiceEventHandlers = {},
  ) {
    this.id = `twilio-voice-${Date.now()}`;
  }

  get state(): TransportState {
    return this._state;
  }
  get isConnected(): boolean {
    return this._state === "connected";
  }
  get streamSid(): string | null {
    return this._streamSid;
  }
  get callSid(): string | null {
    return this._callSid;
  }

  async connect(): Promise<void> {
    this._state = "connecting";
  }

  handleWebSocket(ws: WebSocket): void {
    if (this.ws) this.ws.close();
    this.ws = ws;

    if (this.config.streamSid && this.config.callSid) {
      this._streamSid = this.config.streamSid;
      this._callSid = this.config.callSid;
      this._state = "connected";
    } else {
      this._state = "connecting";
    }

    ws.on("message", (data) => this.handleMessage(data));
    ws.on("close", () => {
      this._state = "disconnected";
      this.ws = null;
      this._streamSid = null;
    });
    ws.on("error", () => {
      this._state = "error";
    });
  }

  async disconnect(): Promise<void> {
    for (const [, mark] of this.pendingMarks) {
      clearTimeout(mark.timeout);
      mark.resolve();
    }
    this.pendingMarks.clear();

    if (this.ws && this._streamSid) {
      try {
        this.ws.send(
          JSON.stringify({ event: "stop", streamSid: this._streamSid }),
        );
      } catch {
        /* ignore */
      }
      this.ws.close();
      this.ws = null;
    }
    this._streamSid = null;
    this._callSid = null;
    this._state = "disconnected";
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }

  async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.ws || !this._streamSid) {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    const payload = chunk.payload.toString("base64");
    this.ws.send(
      JSON.stringify({
        event: "media",
        streamSid: this._streamSid,
        media: { payload },
      }),
    );
    this.audioSequence++;
  }

  onAudio(handler: (chunk: AudioChunk) => void): void {
    this.handlers.onAudio = handler;
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.ws || !this._streamSid) {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    if (message.type === "audio" && Buffer.isBuffer(message.payload)) {
      await this.sendAudio({
        payload: message.payload,
        encoding: "mulaw",
        sampleRate: 8000,
        channels: 1,
        timestamp: Date.now(),
      });
    } else {
      this.ws.send(JSON.stringify(message.payload));
    }
  }

  on(): this {
    return this;
  }
  off(): this {
    return this;
  }

  async sendMark(name: string, timeoutMs = 5000): Promise<void> {
    if (!this.ws || !this._streamSid) {
      throw new AgentError({
        code: ERROR_CODES.TRANSPORT_DISCONNECTED,
        message: "Not connected",
      });
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMarks.delete(name);
        reject(new Error(`Mark timeout: ${name}`));
      }, timeoutMs);
      this.pendingMarks.set(name, { resolve, timeout });
      this.ws!.send(
        JSON.stringify({
          event: "mark",
          streamSid: this._streamSid,
          mark: { name },
        }),
      );
    });
  }

  async clearBuffer(): Promise<void> {
    if (this.ws && this._streamSid) {
      this.ws.send(
        JSON.stringify({ event: "clear", streamSid: this._streamSid }),
      );
    }
  }

  private handleMessage(data: RawData): void {
    try {
      const message = JSON.parse(data.toString()) as TwilioStreamMessage;

      switch (message.event) {
        case "connected":
          this.handleConnected(message as TwilioConnectedMessage);
          break;
        case "start":
          this.handleStart(message as TwilioStartMessage);
          break;
        case "media":
          this.handleMedia(message as TwilioMediaMessage);
          break;
        case "dtmf":
          this.handlers.onDtmf?.((message as TwilioDtmfMessage).dtmf.digit);
          break;
        case "mark":
          this.handleMark(message as TwilioMarkMessage);
          break;
        case "stop":
          this.handleStop(message as TwilioStopMessage);
          break;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  private handleConnected(_message: TwilioConnectedMessage): void {
    // Wait for 'start' event to get streamSid/callSid.
  }

  private handleStart(message: TwilioStartMessage): void {
    this._streamSid = message.streamSid;
    this._callSid = message.start.callSid;
    this._state = "connected";
    this.handlers.onStreamStart?.(
      this._streamSid,
      this._callSid,
      message.start.customParameters,
    );
  }

  private handleMedia(message: TwilioMediaMessage): void {
    const audioData = Buffer.from(message.media.payload, "base64");
    const chunk: AudioChunk = {
      payload: audioData,
      encoding: this.config.encoding ?? "mulaw",
      sampleRate: this.config.sampleRate ?? 8000,
      channels: 1,
      timestamp: message.media.timestamp
        ? parseInt(message.media.timestamp, 10)
        : Date.now(),
      sequenceNumber: parseInt(message.sequenceNumber, 10),
    };
    this.audioSequence++;
    this.handlers.onAudio?.(chunk);
  }

  private handleMark(message: TwilioMarkMessage): void {
    const name = message.mark.name;
    const pending = this.pendingMarks.get(name);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve();
      this.pendingMarks.delete(name);
    }
    this.handlers.onMark?.(name);
  }

  private handleStop(message: TwilioStopMessage): void {
    this.handlers.onStreamStop?.(`Call ended: ${message.stop.callSid}`);
    this._state = "disconnected";
  }
}

export function createTwilioVoiceTransport(
  config?: TwilioVoiceConfig,
  handlers?: TwilioVoiceEventHandlers,
): TwilioVoiceTransport {
  return new TwilioVoiceTransport(config, handlers);
}
