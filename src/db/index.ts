import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Ban } from "./entity/Ban.js";
import { Channel } from "./entity/Channel.js";
import { Settings } from "./entity/Settings.js";
import { User } from "./entity/User.js";
import { Init1661383880638 } from "./migrations/1661383880638-init.js";
import { AddSettingsTable1713993558783 } from "./migrations/1713993558783-AddSettingsTable.js";
import { InsertSettingsForUsers1713994509519 } from "./migrations/1713994509519-InsertSettingsForUsers.js";
import { AddUniqueConstraintToTwitchId1713998180497 } from "./migrations/1713998180497-AddUniqueConstraintToTwitchId.js";
import { AddBanSchema1714768431257 } from "./migrations/1714768431257-AddBanSchema.js";

const { DB_HOST, DB_USERNAME, DEBUG_POSTGRES, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

const connection = new DataSource({
  type: "postgres",
  host: DB_HOST,
  port: Number(DB_PORT),
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [User, Channel, Settings, Ban],
  migrations: [
    Init1661383880638,
    AddSettingsTable1713993558783,
    InsertSettingsForUsers1713994509519,
    AddUniqueConstraintToTwitchId1713998180497,
    AddBanSchema1714768431257,
  ],
  logging: DEBUG_POSTGRES === "true",
  synchronize: false,
  poolSize: 5,
});

export default connection;
