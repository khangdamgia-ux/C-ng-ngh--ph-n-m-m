/** Khóa tạm sau 5 lần đăng nhập sai liên tiếp trong 15 phút theo IP + username (FR-13, NFR-04). */
export class LoginLimiter {
  private failures = new Map<string, { count: number; first: number }>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private key(ip: string, username: string) {
    return `${ip}|${username.toLowerCase()}`;
  }

  isLocked(ip: string, username: string): boolean {
    const entry = this.failures.get(this.key(ip, username));
    if (!entry) return false;
    if (this.now() - entry.first > this.windowMs) {
      this.failures.delete(this.key(ip, username));
      return false;
    }
    return entry.count >= this.maxAttempts;
  }

  recordFailure(ip: string, username: string) {
    const k = this.key(ip, username);
    const entry = this.failures.get(k);
    if (!entry || this.now() - entry.first > this.windowMs) this.failures.set(k, { count: 1, first: this.now() });
    else entry.count++;
  }

  reset(ip: string, username: string) {
    this.failures.delete(this.key(ip, username));
  }
}
