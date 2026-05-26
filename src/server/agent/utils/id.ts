/**
 * ID Generators - Lightweight ID generation using Node.js crypto
 * Uses crypto.randomUUID() for zero external dependencies.
 */

import { randomUUID } from "node:crypto";

/**
 * Generate a unique ID with optional prefix
 * @example generateId('sess') // "sess_a1b2c3d4"
 */
export function generateId(prefix?: string): string {
  const uuid = randomUUID().replace(/-/g, "").slice(0, 12);
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Generate a call ID for tool/function calls
 * @example "call_a1b2c3d4e5f6"
 */
export function generateCallId(): string {
  return generateId("call");
}

/**
 * Generate a session ID for voice/SMS sessions
 * @example "session_a1b2c3d4e5f6"
 */
export function generateSessionId(): string {
  return generateId("session");
}

/**
 * Generate a request ID for HTTP requests
 * @example "req_a1b2c3d4e5f6"
 */
export function generateRequestId(): string {
  return generateId("req");
}
