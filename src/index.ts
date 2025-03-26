import { router } from "@commands/index.js";
import { queue } from "@constants/queue.js";
import { client } from "@constants/tmi.js";
import connection from "@db/index.js";
import { redisClient, sub } from "@db/redis.js";
import { Responder } from "@lib/responder.js";
import { logger } from "@utils/loggers.js";
import { parseMessage } from "@utils/parser.js";
import "dotenv/config";
import "reflect-metadata";
import { App } from "src/app.js";
import type { ChatUserstate } from "tmi.js";

const { PORT, URL, COMMAND_PREFIX, NODE_ENV, RENDER_GIT_COMMIT, TWITCH_USERNAME } = process.env;

client.on("chat", clientMessageHandler);

sub.on("pmessage", handleMessage);

process.on("SIGTERM", gracefulShutdown);

export const app = new App();
app.start();

async function handleMessage(pattern: string, channel: string, message: string) {
  if (message !== "expired") return;

  const [, room] = channel.split(":");

  app.manager[room].playNextSong(room);
}

async function gracefulShutdown(signal: NodeJS.Signals) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  app.io.close(async () => {
    logger.info("Http server closed...");
    await connection.destroy();
    logger.info("PostgreSQL connection closed...");
    await redisClient.quit();
    logger.info("Redis connection closed...");
    await sub.quit();
    logger.info("Redis Sub connection closed...");
    logger.info("Exiting...");
    process.exit(0);
  });
}

async function clientMessageHandler(channel: string, tags: ChatUserstate, message: string, self: boolean) {
  if (self) return;

  const [prefix, command, ...args] = parseMessage(message);

  if (prefix.toLowerCase() !== `!${COMMAND_PREFIX}`) return;

  const room = channel.slice(1);

  const responder = new Responder(client, tags, room, queue);

  logger.info("Recieved command", { username: tags["username"], channel, command, args });

  await router.route({ responder, room, tags, manager: app.manager[room] }, [prefix.toLowerCase(), command, ...args], 0);
}
