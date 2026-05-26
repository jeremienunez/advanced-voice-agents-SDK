/**
 * SentenceBuffer — Accumulates LLM text deltas, flushes on sentence boundaries.
 * Used to dispatch TTS per sentence for pipelining.
 */

// French-aware sentence boundaries: . ! ? ; followed by space, or end of stream
const BOUNDARY = /[.!?;]\s/;

export class SentenceBuffer {
  private text = "";

  /** Push a text delta. Returns a complete sentence if boundary found, null otherwise. */
  push(delta: string): string | null {
    this.text += delta;

    const match = BOUNDARY.exec(this.text);
    if (match) {
      // Split at boundary (include the punctuation, not the trailing space)
      const splitIndex = match.index + match[0].length - 1;
      const sentence = this.text.slice(0, splitIndex).trim();
      this.text = this.text.slice(splitIndex).trimStart();
      return sentence || null;
    }

    return null;
  }

  /** Flush any remaining text (call at end of LLM stream). */
  flush(): string {
    const remaining = this.text.trim();
    this.text = "";
    return remaining;
  }
}
