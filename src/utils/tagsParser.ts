import type { ChatUserstate } from "tmi.js";

const { FM_OWNER_ID } = process.env;

export function parseTags(tags: ChatUserstate) {
  const isMod = tags.mod;
  const isBroadcaster = tags.badges?.broadcaster === "1";
  const isOwner = tags["user-id"] === FM_OWNER_ID;

  return { isMod, isBroadcaster, isOwner };
}
