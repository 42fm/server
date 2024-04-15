import { redisClient } from "@db/redis";
import { Context } from "@lib/router";

export async function countUsage(ctx: Context, args: string[], next: () => void) {
  redisClient.incr(`count:${ctx.room}`);
  next();
}
