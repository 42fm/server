import tmi from "#tmi";
import { logger } from "@utils/loggers.js";

const { NODE_ENV, DEBUG_TMI, TWITCH_USERNAME, TWITCH_OAUTH } = process.env;

const clientLogger = logger.child({
  service: "tmi",
});

export const client = new tmi.Client({
  options: {
    debug: DEBUG_TMI === "true",
    skipMembership: true,
  },
  connection: {
    reconnect: NODE_ENV === "production",
    secure: NODE_ENV === "production",
  },
  logger: {
    info: (msg) => clientLogger.info(msg),
    warn: (msg) => clientLogger.warn(msg),
    error: (msg) => clientLogger.error(msg),
  },
  identity: {
    username: TWITCH_USERNAME,
    password: TWITCH_OAUTH,
  },
  channels: [],
});
