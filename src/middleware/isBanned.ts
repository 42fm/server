import { Ban } from "@db/entity/Ban.js";
import { Context } from "@lib/router.js";

export async function isBanned(ctx: Context, args: string[], next: () => void) {
  const ban = await Ban.findOne({ where: { channel_twitch_id: ctx.tags["room-id"], user_twitch_id: ctx.tags["user-id"] } });

  if (ban) {
    ctx.responder.respondWithMention("you are banned from this channel");
    return;
  }

  next();
}
