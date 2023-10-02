import { ONE_DAY_IN_SECONDS } from "@constants/constants";
import { redisClient } from "@db/redis";

class RateLimiter {
  maxMessagesPerDay: number;

  constructor(maxMessagesPerDay: number) {
    this.maxMessagesPerDay = maxMessagesPerDay;
  }

  async consume(userID: string) {
    const res = await redisClient
      .multi()
      .incr("ratelimit:" + userID)
      .expire("ratelimit:" + userID, ONE_DAY_IN_SECONDS)
      .exec();

    const [incError, inc] = res[0] as any;
    const [expireError, expire] = res[1] as any;

    return inc > this.maxMessagesPerDay;
  }
}

export default RateLimiter;
