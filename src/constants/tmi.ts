import tmi from "tmi.js";

const { NODE_ENV, PORT, TWITCH_USERNAME, TWITCH_OAUTH, COMMAND_PREFIX } = process.env;

export const client = new tmi.Client({
  options: {
    debug: NODE_ENV === "production" ? false : true,
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
