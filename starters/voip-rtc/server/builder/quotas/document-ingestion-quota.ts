export interface DocumentIngestionQuotaInput {
  clientIp?: string;
}

export interface DocumentIngestionQuotaDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface DocumentIngestionQuotaPort {
  consume(input: DocumentIngestionQuotaInput): DocumentIngestionQuotaDecision;
}

export interface InMemoryDocumentIngestionQuotaOptions {
  maxRequests: number;
  windowMs: number;
  clock?: () => number;
}

interface QuotaBucket {
  count: number;
  windowStartedAt: number;
}

export class InMemoryDocumentIngestionQuota
  implements DocumentIngestionQuotaPort {
  private readonly buckets = new Map<string, QuotaBucket>();
  private readonly clock: () => number;

  constructor(private readonly options: InMemoryDocumentIngestionQuotaOptions) {
    this.clock = options.clock ?? (() => Date.now());
  }

  consume(input: DocumentIngestionQuotaInput): DocumentIngestionQuotaDecision {
    const key = input.clientIp ?? "unknown";
    const now = this.clock();
    const bucket = this.currentBucket(key, now);
    if (bucket.count >= this.options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(
          0,
          bucket.windowStartedAt + this.options.windowMs - now,
        ),
      };
    }
    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.options.maxRequests - bucket.count,
    };
  }

  private currentBucket(key: string, now: number): QuotaBucket {
    const existing = this.buckets.get(key);
    if (existing && now - existing.windowStartedAt < this.options.windowMs) {
      return existing;
    }
    const next = { count: 0, windowStartedAt: now };
    this.buckets.set(key, next);
    return next;
  }
}
