import { redisClient } from "@db/redis.js";
import { logger } from "@root/utils/loggers.js";

export async function incrementKey(key: string, time: number): Promise<number> {
  try {
    const res = await redisClient
      .multi()
      .incr("ratelimit:" + key)
      .expire("ratelimit:" + key, time)
      .exec();

    if (!res) {
      throw new Error("no response");
    }

    if (res[0][0]) {
      throw res[0][0];
    }

    if (res[1][0]) {
      throw res[1][0];
    }

    return res[0][1] as number;
  } catch (err) {
    logger.error(err);
    throw err;
  }
}
