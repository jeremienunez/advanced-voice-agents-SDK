/**
 * SMS Utilities - Segment calculation and message splitting
 * Handles GSM-7 vs UCS-2 encoding detection and SMS segment limits.
 */

/**
 * SMS segment limits based on encoding
 */
export const SMS_LIMITS = {
  GSM7_SINGLE: 160, // Single segment GSM-7
  GSM7_MULTI: 153, // Multi-segment GSM-7 (7 bytes for UDH)
  UCS2_SINGLE: 70, // Single segment Unicode
  UCS2_MULTI: 67, // Multi-segment Unicode
} as const;

/**
 * GSM-7 basic character set (simplified check)
 * Full set includes: A-Z, a-z, 0-9, space, and specific symbols
 * Non-GSM-7 characters require UCS-2 encoding
 */
const NON_ASCII_PATTERN = /[^\x00-\x7F]/;

/**
 * Check if text contains only GSM-7 compatible characters
 * Returns false if any character requires UCS-2 encoding
 */
export function isGsm7(text: string): boolean {
  return !NON_ASCII_PATTERN.test(text);
}

/**
 * Calculate the number of SMS segments required for a message
 * Takes into account GSM-7 vs UCS-2 encoding
 */
export function calculateSmsSegments(body: string): number {
  if (!body || body.length === 0) return 0;

  const useGsm7 = isGsm7(body);
  const singleLimit = useGsm7 ? SMS_LIMITS.GSM7_SINGLE : SMS_LIMITS.UCS2_SINGLE;
  const multiLimit = useGsm7 ? SMS_LIMITS.GSM7_MULTI : SMS_LIMITS.UCS2_MULTI;

  if (body.length <= singleLimit) return 1;
  return Math.ceil(body.length / multiLimit);
}

/**
 * Split a message into SMS segments with intelligent break points
 * Tries to break at spaces/punctuation when possible
 */
export function splitSmsMessage(body: string, maxSegments = 3): string[] {
  if (!body || body.length === 0) return [];

  const segments: string[] = [];
  const useGsm7 = isGsm7(body);
  const limit = useGsm7 ? SMS_LIMITS.GSM7_MULTI : SMS_LIMITS.UCS2_MULTI;

  let remaining = body;

  while (remaining.length > 0 && segments.length < maxSegments) {
    // If remaining fits in one segment, add it and done
    if (remaining.length <= limit) {
      segments.push(remaining);
      break;
    }

    // Find a good break point (prefer space, then punctuation)
    let breakPoint = remaining.lastIndexOf(" ", limit);

    // If no space found or too early, try punctuation
    if (breakPoint < limit * 0.5) {
      const punctuation = [".", ",", "!", "?", ";", ":"];
      for (const p of punctuation) {
        const idx = remaining.lastIndexOf(p, limit);
        if (idx > breakPoint) breakPoint = idx + 1; // Include the punctuation
      }
    }

    // If still no good break point, hard break at limit
    if (breakPoint < limit * 0.5) {
      breakPoint = limit;
    }

    segments.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return segments;
}

/**
 * Get encoding info for a message
 */
export function getSmsEncodingInfo(body: string): {
  encoding: "gsm7" | "ucs2";
  segments: number;
  charactersPerSegment: number;
  totalCharacters: number;
} {
  const useGsm7 = isGsm7(body);
  const segments = calculateSmsSegments(body);

  return {
    encoding: useGsm7 ? "gsm7" : "ucs2",
    segments,
    charactersPerSegment:
      segments === 1
        ? useGsm7
          ? SMS_LIMITS.GSM7_SINGLE
          : SMS_LIMITS.UCS2_SINGLE
        : useGsm7
          ? SMS_LIMITS.GSM7_MULTI
          : SMS_LIMITS.UCS2_MULTI,
    totalCharacters: body.length,
  };
}
