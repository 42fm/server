import { router } from "@commands/index";
import { config } from "@constants/config";
import { queue } from "@constants/queue";
import { client } from "@constants/tmi";
import { User } from "@db/entity/User";
import connection from "@db/index";
import { redisClient, sub } from "@db/redis";
import { Responder } from "@lib/responder";
import morganMiddleware from "@middleware/morganMiddleware";
import healthRouter from "@routes/health";
import { logger } from "@utils/loggers";
import { parseMessage } from "@utils/parser";
import { sleep } from "@utils/sleep";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import "reflect-metadata";
import { Server, ServerOptions } from "socket.io";
import authRouter from "./routes/auth";

const { PORT, URL, COMMAND_PREFIX } = process.env;

const app = express();

const httpServer = createServer(app);

const options: Partial<ServerOptions> = {
  cors: {
    origin: [URL],
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
app.use(authRouter);
app.use(healthRouter);

client.on("message", async (channel, tags, message, self) => {
  // Ignore echoed messages and not valid commands
  if (self) return;

  const [prefix, command, ...args] = parseMessage(message);

  if (prefix.toLowerCase() !== `!${COMMAND_PREFIX}`) return;

  const room = channel.slice(1);

  const responder = new Responder(client, tags, room, queue);

  logger.info("Command sent", { username: tags["display-name"], channel, command, args });

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
        const song = replies[0][1] as string;
        const playlist = replies[1][1] as string[];

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
  } catch (e) {
    logger.info("Error while connecting to channels");
    logger.error(e);
  }
}

async function main() {
  try {
    await client.connect();
  } catch (error) {
    logger.error(error);
  }

  try {
    await config.init();
  } catch (error) {
    logger.error(error);
  }

  try {
    await connectToChannels();
  } catch (error) {
    logger.error(error);
  }

  if (process.env.NODE_ENV === "development") {
    const user = await User.findOne({ where: { twitch_id: "158734200" } });

    if (!user) {
      const newUser = User.create({
        twitch_id: "158734200",
        username: "loczuk2001",
        display_name: "loczuk2001",
        email: "test@test.com",
      });

      await newUser.save();
    }
  }

  io.on("connection", (socket) => {
    logger.info("New connection", { id: socket.id, ip: socket.handshake.address });

    socket.on("error", (err) => {
      logger.info("socket error", err);
    });

    socket.on("joinRoom", async (data) => {
      const room = data.room.toLowerCase();

      const user = await User.findOne({ where: { username: room } });

      if (!user) {
        logger.info("42fm not enabled on channel", { channel: room });
        socket.emit("no42fm");
        socket.disconnect();
        return;
      }

      logger.info("Socket joined room", { socket: socket.id, room: room });
      await socket.join(room);

      const sockets = await io.in(room).fetchSockets();

      io.in(room).emit("userCount", sockets.length);

      redisClient
        .multi()
        .get(`${room}:current`)
        .lrange(`${room}:playlist`, 0, -1)
        .ttl(`${room}:current`)
        .exec((err, replies) => {
          const [, current] = replies[0] as [Error, string];
          const [, playlist] = replies[1] as [Error, string[]];
          const [, ttl] = replies[2] as [Error, number];

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

          logger.info(`${JSON.stringify(currentWithTTL)}`);

          if (current && playlist) {
            const list = playlist.map((item: string) => JSON.parse(item));
            socket.emit("song", { current: currentWithTTL, list });
          }
        });
    });

    socket.on("sync", (data) => {
      const room = data.room.toLowerCase();

      logger.info("Sync event", { room });
      redisClient
        .ttl(`${room}:current`)
        .then((ttl) => {
          if (ttl > 0) {
            logger.debug(ttl);
            socket.emit("songSync", ttl);
          }
        })
        .catch((err) => logger.error(err));
    });

    socket.on("disconnecting", async () => {
      for (const room of Array.from(socket.rooms).slice(1)) {
        const sockets = await io.in(room).fetchSockets();
        io.in(room).emit("userCount", sockets.length - 1);
        logger.info(room, sockets.length);
      }
    });
  });
}

(async function () {
  await connection.initialize();
  logger.info("Initialized connection to database");

  await connection.runMigrations();
  logger.info("Ran migrations");

  main();

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server started on port ${PORT}`);
  });
})();

process.on("SIGTERM", () => {
  httpServer.close(() => {
    logger.info("Http server closed");
    io.close(async () => {
      logger.info("IO server closed");
      await connection.destroy();
      logger.info("Database connection closed");
      await redisClient.quit();
      logger.info("Redis connection closed");
      await sub.quit();
      logger.info("Redis Sub connection closed");
      process.exit(0);
    });
  });
});
