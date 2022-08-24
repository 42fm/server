import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Channel } from "./entity/Channel";
import { User } from "./entity/User";

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;

const connection = new DataSource({
  type: "postgres",
  host: DB_HOST,
  port: 5432,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [User, Channel],
  migrations: ["src/db/migrations/**/*.ts"],
  logging: false,
});

export default connection;
