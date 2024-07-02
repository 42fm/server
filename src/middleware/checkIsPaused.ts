import { redisClient } from "@db/redis.js";
import { Args, Context, Next } from "@lib/router.js";

export async function checkIsPaused(ctx: Context, args: Args, next: Next) {
  const isPaused = await redisClient.get(`${ctx.room}:paused`);

  if (isPaused) {
    ctx.responder.respondWithMention("action disabled while paused");
    return;
  }

  next();
}
