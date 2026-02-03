import { router } from "@bot/routes/index.js";
import { queue } from "@config/queue.js";
import { client } from "@config/tmi.js";
import connection from "@db/index.js";
import { redisClient, sub } from "@db/redis.js";
import { Responder } from "@lib/responder.js";
import { logger } from "@utils/loggers.js";
import { parseMessage } from "@utils/parser.js";
import "dotenv/config";
import "reflect-metadata";
import type { ChatUserstate } from "tmi.js";
import { App } from "./app.js";

const { COMMAND_PREFIX } = process.env;

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
  logger.info(`Received ${signal} signal, shuting down`);

  app.io.close(async () => {
    logger.info("HTTP server closed");

    await app.client.disconnect();
    logger.info("Disconnected twitch client");

    await connection.destroy();
    logger.info("PostgreSQL connection closed");

    await redisClient.quit();
    logger.info("Redis connection closed");

    await sub.quit();
    logger.info("Redis Sub connection closed");

    logger.info("Exiting");
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
