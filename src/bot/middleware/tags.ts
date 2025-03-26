import type { Args, Context, Next } from "@lib/router.js";
import { parseTags } from "@utils/tagsParser.js";

export function isOwnerOrOwnerRoom(ctx: Context, args: Args, next: Next) {
  const { isOwner } = parseTags(ctx.tags);

  if (isOwner || ctx.room === process.env.FM_OWNER_USERNAME) next();
}

export function isOwner(ctx: Context, args: Args, next: Next) {
  const { isOwner } = parseTags(ctx.tags);

  if (isOwner) next();
}

export function isOwnerBroadcasterMod(ctx: Context, args: Args, next: Next) {
  const { isBroadcaster, isMod, isOwner } = parseTags(ctx.tags);

  if (isBroadcaster || isMod || isOwner) next();
}
