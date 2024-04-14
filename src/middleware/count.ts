import { redisClient } from "@db/redis";
import { Context } from "@lib/router";
import { logger } from "@utils/loggers";

export async function countUsage(ctx: Context, args: string[], next: () => void) {
  try {
    await redisClient.incr(`count:${ctx.room}`);
  } catch (e) {
    logger.error(e);
  }

  next();
}
