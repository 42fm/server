import { Ban } from "@db/entity/Ban.js";
import { Args, Context, Next } from "@lib/router.js";

export async function isBanned(ctx: Context, args: Args, next: Next) {
  const ban = await Ban.findOne({ where: { channel_twitch_id: ctx.tags["room-id"], user_twitch_id: ctx.tags["user-id"] } });

  if (ban) {
    ctx.responder.respondWithMention("you are banned from this channel");
    return;
  }

  next();
}
