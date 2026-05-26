/**
 * Twilio SMS Transport - Stateless REST API wrapper
 * Implements ISmsTransport - no connection state, each request is independent
 */

import type {
  ISmsTransport,
  TransportState,
  TransportMessage,
} from "../types/transport.types.js";
import type {
  SmsInboundWebhook,
  SmsStatusWebhook,
  SmsStatus,
} from "../types/twilio.types.js";
import { AgentError, ERROR_CODES } from "../types/error.types.js";
import { calculateSmsSegments, splitSmsMessage } from "../utils/sms.js";

// Configuration for Twilio SMS
export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  maxSegments?: number;
}

// Twilio API response
interface TwilioSmsResponse {
  sid: string;
  status: string;
  numSegments: string;
}

export class TwilioSmsTransport implements ISmsTransport {
  readonly id: string;
  readonly type = "twilio-sms" as const;

  constructor(private readonly config: TwilioSmsConfig) {
    this.id = `twilio-sms-${Date.now()}`;
  }

  // Stateless - always "connected" if config is valid
  get state(): TransportState {
    return "connected";
  }
  get isConnected(): boolean {
    return true;
  }

  // No-ops for stateless transport
  async connect(): Promise<void> {
    /* stateless */
  }
  async disconnect(): Promise<void> {
    /* stateless */
  }
  async dispose(): Promise<void> {
    /* stateless */
  }

  // ISmsTransport implementation
  async sendSms(
    to: string,
    body: string,
    from?: string,
  ): Promise<{ messageSid: string; segmentCount: number }> {
    const segments = calculateSmsSegments(body);
    const maxSegments = this.config.maxSegments ?? 3;

    if (segments > maxSegments) {
      throw new AgentError({
        code: ERROR_CODES.TWILIO_SMS_FAILED,
        message: `Message exceeds max segments (${segments} > ${maxSegments})`,
      });
    }

    const response = await this.callTwilioApi(to, body, from);
    return {
      messageSid: response.sid,
      segmentCount: parseInt(response.numSegments, 10),
    };
  }

  // ITransport implementation
  async send(message: TransportMessage): Promise<void> {
    if (message.type === "sms") {
      const payload = message.payload as { to: string; body: string };
      await this.sendSms(payload.to, payload.body);
    }
  }

  on(): this {
    return this;
  }
  off(): this {
    return this;
  }

  // Webhook parsers (pure functions)
  parseInboundWebhook(data: Record<string, string>): SmsInboundWebhook {
    return {
      MessageSid: data.MessageSid ?? "",
      AccountSid: data.AccountSid ?? "",
      From: data.From ?? "",
      To: data.To ?? "",
      Body: data.Body ?? "",
      NumMedia: data.NumMedia ?? "0",
      NumSegments: data.NumSegments ?? "1",
      MessagingServiceSid: data.MessagingServiceSid,
    };
  }

  parseStatusWebhook(data: Record<string, string>): SmsStatusWebhook {
    return {
      MessageSid: data.MessageSid ?? "",
      AccountSid: data.AccountSid ?? "",
      From: data.From ?? "",
      To: data.To ?? "",
      MessageStatus: (data.MessageStatus ?? "sent") as SmsStatus,
      ErrorCode: data.ErrorCode,
      ErrorMessage: data.ErrorMessage,
    };
  }

  // Utility methods (delegate to utils/sms.ts)
  getSegmentCount(body: string): number {
    return calculateSmsSegments(body);
  }

  splitMessageIntoParts(body: string, maxSegments = 3): string[] {
    return splitSmsMessage(body, maxSegments);
  }

  // Private helpers
  private async callTwilioApi(
    to: string,
    body: string,
    from?: string,
  ): Promise<TwilioSmsResponse> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;

    const fromNumber = from ?? this.config.fromNumber ?? "";
    const formData = new URLSearchParams({
      To: to,
      Body: body,
      ...(this.config.messagingServiceSid
        ? { MessagingServiceSid: this.config.messagingServiceSid }
        : { From: fromNumber }),
    });

    const auth = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new AgentError({
        code: ERROR_CODES.TWILIO_SMS_FAILED,
        message: error.message || `HTTP ${response.status}`,
      });
    }

    return response.json() as Promise<TwilioSmsResponse>;
  }
}

// Factory function
export function createTwilioSmsTransport(
  config: TwilioSmsConfig,
): TwilioSmsTransport {
  return new TwilioSmsTransport(config);
}
