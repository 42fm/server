import { winstonMiddleware } from "@api/middleware/logger.js";
import { eventsRouter } from "@api/routes/events.js";
import { healthRouter } from "@api/routes/health.js";
import { client } from "@config/tmi.js";
import connection from "@db/index.js";
import { SongManager } from "@lib/manager.js";
import { getUsersWithEnabledChannel } from "@services/user.js";
import { logger } from "@utils/loggers.js";
import { sleep } from "@utils/sleep.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Application } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import type { Server as IoServer } from "socket.io";
import type { Client } from "tmi.js";
import { createSocketServer } from "./socket.js";
import { authRouter } from "@api/routes/auth.js";

class App {
  app: Application;
  httpServer: HttpServer;
  io: IoServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  client: Client;
  manager: Record<string, SongManagerI>;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    const temp = createSocketServer(this.httpServer);
    this.io = temp;
    this.manager = new Proxy<Record<string, SongManager>>(
      {},
      {
        get(target, value) {
          const val = value.toString();
          if (target[val] === undefined) {
            target[val] = new SongManager(temp);
          }
          return target[val];
        },
      }
    );

    this.client = client;
    this.initMiddleware();
    this.initRoutes();
  }

  initMiddleware() {
    this.app.use(
      cors({
        // origin: URL,
        credentials: true,
      })
    );
    this.app.use(winstonMiddleware);
    this.app.use(cookieParser());
  }

  initRoutes() {
    this.app.use(healthRouter);
    this.app.use(authRouter);
    this.app.use(eventsRouter);
  }

  async start() {
    const { PORT, NODE_ENV, RENDER_GIT_COMMIT, TWITCH_USERNAME } = process.env;

    try {
      logger.info("Initializing database connection...");
      await connection.initialize();

      logger.info("Running migrations...");
      await connection.runMigrations();

      logger.info("Connecting to twitch...");
      await this.client.connect();

      await connectToChannels();

      if (NODE_ENV === "production") {
        client.say(TWITCH_USERNAME!, `version ${RENDER_GIT_COMMIT!.slice(0, 7)} is live`);
      }

      this.httpServer.listen(PORT, () => {
        logger.info(`Server started on port ${PORT}`);
      });
    } catch (error) {
      logger.error(error);
      process.exit(1);
    }
  }

  stop() {}
}

async function connectToChannels() {
  try {
    const users = await getUsersWithEnabledChannel();

    for (const user of users) {
      try {
        await client.join(user.username);
        logger.info("Joined channel", { channel: user.username });
        await sleep(600);
      } catch (error) {
        logger.warn("Failed to join channel", { error, channel: user.username });
      }
    }

    logger.debug("Connected to channels from database");
  } catch (error) {
    logger.error("Error while connecting to channels", { error });
  }
}

export { App };
