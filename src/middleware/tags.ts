import { Context } from "../lib/router";
import { parseTags } from "../utils/tagsParser";

export function isOwner(ctx: Context, args: string[], next: () => void) {
  const { isOwner } = parseTags(ctx.tags);

  if (isOwner) next();
}
export function isOwnerBroadcasterMod(ctx: Context, args: string[], next: () => void) {
  const { isBroadcaster, isMod, isOwner } = parseTags(ctx.tags);

  if (isBroadcaster || isMod || isOwner) next();
}
