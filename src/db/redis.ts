import { Redis } from "ioredis";
import { logger } from "../utils/loggers.js";

const { REDIS_URL } = process.env;

export const redisClient = new Redis(REDIS_URL!);
export const sub = new Redis(REDIS_URL!);

redisClient.on("connect", () => {
  logger.debug("Redis client connected");
});

sub.on("connect", () => {
  logger.debug("Redis subscriber connected");
});

sub.psubscribe("__keyspace@0__:*:current", () => {
  logger.debug("Redis subscriber subscribed to current keyspace");
});
