import { redisClient } from "@db/redis.js";
import { Context } from "@lib/router.js";

export async function countUsage(ctx: Context, args: string[], next: () => void) {
  redisClient.incr(`count:${ctx.room}`);
  next();
}
