import type { Args, Context, Next } from "@lib/router.js";

export async function checkIsPaused(ctx: Context, args: Args, next: Next) {
  const isPaused = await ctx.manager.isPaused(ctx.room);

  if (isPaused) {
    ctx.responder.respondWithMention("action disabled while paused");
    return;
  }

  next();
}
