import { router } from "@commands/index.js";
import { queue } from "@constants/queue.js";
import { client } from "@constants/tmi.js";
import { User } from "@db/entity/User.js";
import connection from "@db/index.js";
import { redisClient, sub } from "@db/redis.js";
import { Responder } from "@lib/responder.js";
import morganMiddleware from "@middleware/morganMiddleware.js";
import eventsRouter from "@routes/events.js";
import healthRouter from "@routes/health.js";
import { logger } from "@utils/loggers.js";
import { parseMessage } from "@utils/parser.js";
import { sleep } from "@utils/sleep.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import "reflect-metadata";
import { Server, ServerOptions } from "socket.io";

const { PORT, URL, COMMAND_PREFIX, NODE_ENV, RENDER_GIT_COMMIT, TWITCH_USERNAME } = process.env;

const app = express();

const httpServer = createServer(app);

const options: Partial<ServerOptions> = {
  cors: {
    origin: [URL!],
  },
};

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);

// Middleware
app.use(
  cors({
    origin: URL,
    credentials: true,
  })
);
app.use(morganMiddleware);
app.use(cookieParser());

// Routes
app.use(healthRouter);
app.use(eventsRouter);

client.on("message", async (channel, tags, message, self) => {
  // Ignore echoed messages and not valid commands
  if (self) return;

  const [prefix, command, ...args] = parseMessage(message);

  if (prefix.toLowerCase() !== `!${COMMAND_PREFIX}`) return;

  const room = channel.slice(1);

  const responder = new Responder(client, tags, room, queue);

  logger.info("Recieved command", { username: tags["username"], channel, command, args });

  router.route({ responder, room, tags }, [prefix.toLowerCase(), command, ...args], 0);
});

sub.on("pmessage", (pattern: string, channel: string, message: string) => {
  if (message === "expired") {
    const [, room] = channel.split(":");

    redisClient
      .multi()
      .lpop(`${room}:playlist`)
      .lrange(`${room}:playlist`, 0, -1)
      .exec((err, replies) => {
        const song = replies![0][1] as string;
        const playlist = replies![1][1] as string[];

        if (!song) return;

        const parsedSong = JSON.parse(song);
        const list = playlist.map((item) => JSON.parse(item));

        const songWithTTL: CurrentSong = {
          ...parsedSong,
          isPlaying: true,
        };

        redisClient
          .setex(`${room}:current`, parsedSong.duration, song)
          .then(() => {
            io.in(room).emit("song", { current: songWithTTL, list });
            redisClient.del(`${room}:votes`);
          })
          .catch((err) => logger.error(err));
      });
  }
});

async function connectToChannels() {
  try {
    const users = await User.find({ where: { channel: { isEnabled: true } } });

    if (!users) {
      logger.info("No users found");
      return;
    }

    for (const user of users) {
      try {
        await client.join(user.username);
        logger.info("Joined channel", { channel: user.username });
        await sleep(600);
      } catch (e) {
        logger.info(e);
      }
    }
    logger.debug("Connected to channels from database");
  } catch (error) {
    logger.error("Error while connecting to channels", { error });
  }
}

async function main() {
  try {
    await client.connect();
  } catch (error) {
    logger.error(error);
  }

  try {
    await connectToChannels();
  } catch (error) {
    logger.error(error);
  }

  if (NODE_ENV === "production") {
    client.say(TWITCH_USERNAME!, `version ${RENDER_GIT_COMMIT!.slice(0, 7)} is live`);
  }

  io.on("connection", (socket) => {
    const childLogger = logger.child({
      service: "ws",
      socketId: socket.id,
      ip: (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0],
    });

    childLogger.info("New socket connection");

    socket.on("error", (err) => {
      childLogger.info("socket error", err);
    });

    socket.on("joinRoom", async (data) => {
      const room = data.room.toLowerCase();

      const user = await User.findOne({ where: { username: room } });

      if (!user) {
        childLogger.info("Not enabled on channel", { room });
        socket.emit("no42fm");
        socket.disconnect();
        return;
      }

      childLogger.info("Joined room", { room });
      await socket.join(room);

      const sockets = await io.in(room).fetchSockets();

      io.in(room).emit("userCount", sockets.length);

      redisClient
        .multi()
        .get(`${room}:current`)
        .lrange(`${room}:playlist`, 0, -1)
        .ttl(`${room}:current`)
        .exec((err, replies) => {
          const [, current] = replies![0] as [Error, string];
          const [, playlist] = replies![1] as [Error, string[]];
          const [, ttl] = replies![2] as [Error, number];

          let isPlaying;

          if (ttl >= 0) {
            isPlaying = true;
          } else {
            isPlaying = false;
          }

          const currentWithTTL: CurrentSong = {
            ...JSON.parse(current),
            durationRemaining: ttl,
            isPlaying,
          };

          childLogger.debug(`${JSON.stringify(currentWithTTL)}`);

          if (current && playlist) {
            const list = playlist.map((item: string) => JSON.parse(item));
            socket.emit("song", { current: currentWithTTL, list });
          }
        });
    });

    socket.on("sync", (data) => {
      const room = data.room.toLowerCase();

      childLogger.info("Sync event", { room });

      redisClient
        .ttl(`${room}:current`)
        .then((ttl) => {
          if (ttl > 0) {
            childLogger.debug(ttl);
            socket.emit("songSync", ttl);
          }
        })
        .catch((err) => childLogger.error(err));
    });

    socket.on("disconnecting", async () => {
      const rooms = new Set(socket.rooms);
      for (const room of Array.from(rooms).slice(1)) {
        const sockets = await io.in(room).fetchSockets();
        io.in(room).emit("userCount", sockets.length - 1);
        childLogger.info("disconnecting", { room, socketsCount: sockets.length });
      }
    });
  });
}

(async function () {
  logger.info("Initializing database connection...");
  await connection.initialize();

  logger.info("Running migrations...");
  await connection.runMigrations();

  logger.info("Starting server...");
  main();

  httpServer.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
  });
})();

process.on("SIGTERM", async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  io.close(async () => {
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
});
