import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxAttempts = 10;

  assertAllowed(key: string): void {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    if (existing.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }
}
