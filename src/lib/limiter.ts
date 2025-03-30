import { incrementKey } from "@root/services/ratelimit.js";

class RateLimiter {
  time: number;
  max: number;

  constructor({ max, time }: { max: number; time: number }) {
    this.time = time;
    this.max = max;
  }

  async consume(key: string) {
    const res = await incrementKey(key, this.time);

    return res > this.max;
  }
}

export default RateLimiter;
