import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Channel } from "./entity/Channel.js";
import { Settings } from "./entity/Settings.js";
import { User } from "./entity/User.js";

const { DB_HOST, DB_USERNAME, DEBUG_POSTGRES, DB_PASSWORD, DB_NAME } = process.env;

const connection = new DataSource({
  type: "postgres",
  host: DB_HOST,
  port: 5432,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [User, Channel, Settings],
  migrations: ["dist/db/migrations/**/*.js"],
  logging: DEBUG_POSTGRES === "true",
  synchronize: false,
  poolSize: 5,
});

export default connection;
