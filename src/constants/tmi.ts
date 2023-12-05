import tmi from "tmi.js";

const { NODE_ENV, DEBUG_TMI, TWITCH_USERNAME, TWITCH_OAUTH, COMMAND_PREFIX } = process.env;

export const client = new tmi.Client({
  options: {
    debug: !!DEBUG_TMI,
    skipMembership: true,
  },
  connection: {
    reconnect: NODE_ENV === "production",
    secure: NODE_ENV === "production",
  },
  identity: {
    username: TWITCH_USERNAME,
    password: TWITCH_OAUTH,
  },
  channels: [],
});
