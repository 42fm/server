import Redis from "ioredis";
import "dotenv/config";
import { createConnection } from "typeorm";
import { log } from "../utils/loggers";
import { User } from "./entity/User";

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, REDIS_URL } = process.env;

export const connection = createConnection({
  type: "postgres",
  host: DB_HOST,
  port: 5432,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [User],
  synchronize: true,
  logging: false,
});

export const redisClient = new Redis(REDIS_URL);
export const sub = new Redis(REDIS_URL);

redisClient.on("connect", () => {
  log.debug("Redis client connected");
});

sub.on("connect", () => {
  log.debug("Redis subscriber connected");
});

sub.psubscribe(["__keyspace@0__:*:current"], () => {
  log.debug("Redis subscriber subscribed to current keyspace");
});
