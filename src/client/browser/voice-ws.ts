/**
 * Voice WebSocket Client
 *
 * Binary frames for audio (PCM16 24kHz), JSON text frames for control.
 * Reconnection with exponential backoff.
 *
 * @module modules/voice/infrastructure/voice-ws
 */

import type {
  ClientVoiceMessage,
  ServerVoiceMessage,
  VoiceWSCallbacks,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

// =============================================================================
// VoiceWebSocketClient
// =============================================================================

export class VoiceWebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: VoiceWSCallbacks;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string | null = null;
  private intentionalClose = false;

  constructor(callbacks: VoiceWSCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): void {
    this.url = url;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, "client_disconnect");
      this.ws = null;
    }
  }

  sendAudio(buffer: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
    }
  }

  sendControl(message: ClientVoiceMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private openConnection(): void {
    if (!this.url) return;

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.callbacks.onOpen();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary frame: audio from server
        this.callbacks.onAudio(event.data);
      } else if (typeof event.data === "string") {
        // Text frame: JSON control message
        try {
          const message = JSON.parse(event.data) as ServerVoiceMessage;
          this.callbacks.onMessage(message);
        } catch {
          console.error("[VoiceWS] Failed to parse message:", event.data);
        }
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.callbacks.onClose();

      if (!this.intentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.callbacks.onError(event);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `[VoiceWS] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`,
      );
      return;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.openConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createVoiceWSClient(
  callbacks: VoiceWSCallbacks,
): VoiceWebSocketClient {
  return new VoiceWebSocketClient(callbacks);
}
