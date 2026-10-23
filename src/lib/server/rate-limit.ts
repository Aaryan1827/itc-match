/** Fixed-window, in-memory rate limiter. Best effort on serverless platforms:
 * each warm instance keeps its own counters, which still blunts bursts and abuse.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  /**
   * Minimum number of tracked IPs before the eviction pass runs.
   * Keeps memory bounded in long-lived processes while avoiding per-request overhead.
   */
  private static readonly EVICTION_THRESHOLD = 1000;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const time = this.now();
    this.evictExpired(time);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= time) {
      this.hits.set(key, { count: 1, resetAt: time + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private evictExpired(time: number): void {
    if (this.hits.size < FixedWindowLimiter.EVICTION_THRESHOLD) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= time) this.hits.delete(key);
    }
  }
}

/** Best-effort client address from proxy headers; falls back to a shared bucket. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
