import { Redis } from "ioredis";
import { log } from "../utils/loggers";

const { REDIS_URL } = process.env;

export const redisClient = new Redis(REDIS_URL!);
export const sub = new Redis(REDIS_URL!);

redisClient.on("connect", () => {
  log.debug("Redis client connected");
});

sub.on("connect", () => {
  log.debug("Redis subscriber connected");
});

sub.psubscribe("__keyspace@0__:*:current", () => {
  log.debug("Redis subscriber subscribed to current keyspace");
});
