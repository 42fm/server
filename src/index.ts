import { router } from "@commands/index";
import { io } from "@constants/io";
import { client } from "@constants/tmi";
import { User } from "@db/entity/User";
import connection from "@db/index";
import { redisClient, sub } from "@db/redis";
import { Queue } from "@lib/queue";
import { Responder } from "@lib/responder";
import morganMiddleware from "@middleware/morganMiddleware";
import auth from "@routes/auth";
import health from "@routes/health";
import { logger } from "@utils/loggers";
import { parseMessage } from "@utils/parser";
import { sleep } from "@utils/sleep";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import "reflect-metadata";

const { NODE_ENV, PORT, COMMAND_PREFIX } = process.env;

const app = express();
export const httpServer = createServer(app);

app.use(
  cors({
    origin: NODE_ENV === "production" ? "https://42fm.app" : "http://localhost:5173",
    credentials: true,
  })
);
app.use(morganMiddleware);
app.use(cookieParser());
app.use(health);
app.use(auth);

client.on("part", (channel, username, self) => {
  if (!self) return;
  logger.debug(`Bot left channel: ${channel}`);
});

client.on("disconnected", (reason) => {
  // Do your stuff.
  logger.debug("Got disconedted from the server", { reason });
});

client.on("reconnect", async () => {
  // Do your stuff.
  logger.debug("Trying to reconnect to server");
  await connectToChannels();
});

// client.on("connected", async () => {
//   // Do your stuff.
//   log.debug("Connected to server");
//   await connectToChannels();
// });

client.on("serverchange", (channel) => {
  // Do your stuff.
  logger.debug("Changed server", { channel });
});

const queue = new Queue(NODE_ENV === "production" ? 30 : 3);

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
  // log.info(`${pattern} ${channel} ${message}`);
  if (message === "expired") {
    const [, room] = channel.split(":");

    redisClient
      .multi()
      .lpop(`${room}:playlist`)
      .lrange(`${room}:playlist`, 0, -1)
      .exec((err, replies) => {
        const song: string = replies[0][1] as any;
        const playlist: string[] = replies[1][1] as any;

        if (!song) return;

        const parsedSong = JSON.parse(song);
        const list = playlist.map((item) => JSON.parse(item));

        const songWithTTL: CurrentSong = {
          ...parsedSong,
          isPlaying: true,
        };

        redisClient
          .setex(`${room}:current`, parsedSong.duration, song)
          .then((current) => {
            io.in(room).emit("song", { current: songWithTTL, list });
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
        await sleep(2000);
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
  // try {
  //   await redisClient.connect();
  //   await connection.initialize();
  // } catch (e) {
  //   log.info("Unable to connect to some db");
  //   log.error(e);
  // }

  try {
    await client.connect();
    await connectToChannels();
  } catch (e) {
    logger.info("Error in client conection");
    logger.error(e);
  }

  if (process.env.NODE_ENV === "development") {
    let user = await User.findOne({ where: { twitch_id: "158734200" } });

    if (!user) {
      let newUser = User.create({
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
      // if (!data.room) {
      //   log.info(`Channel not provided`);
      //   socket.emit("no42fm");
      //   return;
      // }

      const user = await User.findOne({ where: { username: data.room } });

      if (!user) {
        logger.info("42fm not enabled on channel", { channel: data.room });
        socket.emit("no42fm");
        socket.disconnect();
        return;
      }

      // if (!user.channel.isEnabled) {
      //   log.info(`Channel is not enabled`, { channel: data.room });
      //   socket.emit("no42fm");
      //   socket.disconnect();
      //   return;
      // }

      // const is42fm = client.getChannels().includes(`#${data.room}`);

      // if (!is42fm) {
      //   log.info(`Channel is not enabled`, { channel: data.room });
      //   socket.emit("no42fm");
      //   socket.disconnect();
      //   return;
      // }

      logger.info("Socket joined room", { socket: socket.id, room: data.room });
      await socket.join(data.room);

      const sockets = await io.in(data.room).fetchSockets();

      io.in(data.room).emit("userCount", sockets.length);

      redisClient
        .multi()
        .get(`${data.room}:current`)
        .lrange(`${data.room}:playlist`, 0, -1)
        .ttl(`${data.room}:current`)
        .exec((err, replies) => {
          const [currentError, current] = replies[0] as any;
          const [playlistError, playlist] = replies[1] as any;
          const [ttlError, ttl] = replies[2] as any;

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

    socket.on("sync", ({ room }) => {
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

    socket.on("couldNotLoad", async (room) => {
      const errors = await redisClient.incr(`${room}:errors`);
      await redisClient.expire(`${room}:errors`, 10);
      logger.info("Errors", { room, errors });

      const sockets = await io.in(room).fetchSockets();

      const half = sockets.length / 2;

      logger.info("Number of errors", { room, errors, half });
      if (errors > half) {
        client.say(room, "Skipping because could not load song");
        await redisClient.del(`${room}:errors`);
        await skipSong(room);
      }
    });

    socket.on("disconnecting", async () => {
      for (const room of Array.from(socket.rooms).slice(1)) {
        const sockets = await io.in(room).fetchSockets();
        io.in(room).emit("userCount", sockets.length - 1);
        console.log(room, sockets.length);
      }
    });
  });
}

export function skipSong(room: string) {
  return redisClient
    .multi()
    .get(`${room}:current`)
    .lpop(`${room}:playlist`)
    .lrange(`${room}:playlist`, 0, -1)
    .exec((err, replies) => {
      const [currentError, current] = replies[0] as any;
      const [nextSongError, nextSong] = replies[1] as any;

      if (currentError || nextSongError) {
        client.say(room, "Error while skipping");
        return;
      }

      logger.debug("Skip", { current, nextSong });

      if (current === null) {
        client.say(room, "Nothing to skip");
        return;
      }

      // if there is a current song return the next song or return null?
      if (nextSong === null) {
        redisClient
          .del(`${room}:current`)
          .then(() => {
            io.in(room).emit("skip", { type: "noplaylist" });
            // io.in(room).emit("skip", current);
          })
          .catch((err) => logger.error(err));
        return;
      } else {
        const parsedSong = JSON.parse(nextSong);

        const currentWithTTL: CurrentSong = {
          ...parsedSong,
          isPlaying: true,
        };

        redisClient
          .setex(`${room}:current`, parsedSong.duration, nextSong)
          .then(() => {
            io.in(room).emit("skip", {
              type: "playlist",
              current: currentWithTTL,
            });
          })
          .catch((err) => logger.error(err));
      }
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
