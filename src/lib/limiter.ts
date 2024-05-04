import { redisClient } from "@db/redis.js";

class RateLimiter {
  time: number;
  max: number;

  constructor({ max, time }: { max: number; time: number }) {
    this.time = time;
    this.max = max;
  }

  async consume(key: string) {
    const res = await redisClient
      .multi()
      .incr("ratelimit:" + key)
      .expire("ratelimit:" + key, this.time)
      .exec();

    const [, inc] = res![0] as [Error, number];

    return inc > this.max;
  }
}

export default RateLimiter;
