import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Channel } from "./entity/Channel";
import { User } from "./entity/User";

const { DB_HOST, DB_USERNAME, DEBUG_POSTGRES, DB_PASSWORD, DB_NAME, NODE_ENV } = process.env;

const connection = new DataSource({
  type: "postgres",
  host: DB_HOST,
  port: 5432,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [User, Channel],
  migrations: ["./migrations/**/*.ts"],
  logging: DEBUG_POSTGRES === "true",
  synchronize: NODE_ENV === "development",
  poolSize: 5,
});

export default connection;
