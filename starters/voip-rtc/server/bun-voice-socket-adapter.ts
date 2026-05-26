import type {
  BrowserVoiceSocket,
  BrowserVoiceUserContext,
} from "@voiceagentsdk/core/server/browser";

export interface WsData {
  adapter?: BunVoiceSocketAdapter;
  user: BrowserVoiceUserContext;
}

export class BunVoiceSocketAdapter implements BrowserVoiceSocket {
  private readonly handlers = {
    message: [] as Array<(data: unknown, isBinary?: boolean) => void | Promise<void>>,
    close: [] as Array<() => void | Promise<void>>,
    error: [] as Array<(error: unknown) => void | Promise<void>>,
  };

  constructor(private readonly socket: Bun.ServerWebSocket<WsData>) {}

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: string | Buffer): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  on(
    event: "message",
    handler: (data: unknown, isBinary?: boolean) => void | Promise<void>,
  ): this;
  on(event: "close", handler: () => void | Promise<void>): this;
  on(event: "error", handler: (error: unknown) => void | Promise<void>): this;
  on(
    event: "message" | "close" | "error",
    handler:
      | ((data: unknown, isBinary?: boolean) => void | Promise<void>)
      | (() => void | Promise<void>)
      | ((error: unknown) => void | Promise<void>),
  ): this {
    this.handlers[event].push(handler as never);
    return this;
  }

  emitMessage(data: unknown, isBinary: boolean): void {
    for (const handler of this.handlers.message) void handler(data, isBinary);
  }

  emitClose(): void {
    for (const handler of this.handlers.close) void handler();
  }

  emitError(error: unknown): void {
    for (const handler of this.handlers.error) void handler(error);
  }
}
