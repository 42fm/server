import "dotenv/config";
import express from "express";
import { createServer } from "http";
import "reflect-metadata";
import { Server, ServerOptions } from "socket.io";
import tmi from "tmi.js";
import ytdl from "ytdl-core";
import ytsr from "ytsr";
import { ClientToServerEvents, CurrentSong, InterServerEvents, ServerToClientEvents, SocketData, Song } from "../types";
import connection from "./db";
import { User } from "./db/entity/User";
import { redisClient, sub } from "./db/redis";
import morganMiddleware from "./middleware/morganMiddleware";
import auth from "./routes/auth";
import { songs } from "./songs";
import { log } from "./utils/loggers";
import { sleep } from "./utils/sleep";

let SONG_MIN_VIEWS = 50_000; // 100k views
let SONG_MIN_LENGTH = 60; // 1 minute
let SONG_MAX_LENGTH = 600; // 10 minutes
let ONE_HOUR = 3600;
let SKIP_TOPIC = true;
let SONG_COMMAND = false;

const {
  NODE_ENV,
  PORT,
  SOCKETIO_ADMIN_USERNAME,
  SOCKETIO_ADMIN_PASSWORD,
  TWITCH_USERNAME,
  TWITCH_OAUTH,
  COMMAND_PREFIX,
  FM_OWNER_ID,
} = process.env;

const app = express();
const httpServer = createServer(app);

app.use(auth);
app.use(morganMiddleware);

const options: Partial<ServerOptions> = {
  cors: {
    allowedHeaders: ["Access-Control-Allow-Origin"],
    origin: ["https://www.twitch.tv"],
    credentials: true,
  },
};

export const client = new tmi.Client({
  options: {
    debug: NODE_ENV === "production" ? false : true,
    skipMembership: true,
  },
  connection: {
    reconnect: NODE_ENV === "production" ? true : false,
    secure: NODE_ENV === "production" ? true : false,
  },
  identity: {
    username: TWITCH_USERNAME,
    password: TWITCH_OAUTH,
  },
  channels: [],
});

client.on("part", (channel, username, self) => {
  if (!self) return;
  log.warn(`Bot left channel: ${channel}`);
});

client.on("disconnected", (reason) => {
  // Do your stuff.
  log.warn("Got disconedted from the server", { reason });
});

client.on("reconnect", async () => {
  // Do your stuff.
  log.warn("Reconnected to server");
  await connectToChannels();
});

client.on("serverchange", (channel) => {
  // Do your stuff.
  log.warn("Changed server", { channel });
});

client.on("message", async (channel, tags, message, self) => {
  // Ignore echoed messages and not valid commands
  if (self || !message.startsWith(`!${COMMAND_PREFIX}`)) return;

  log.info(`${tags["display-name"]} send a command on ${channel}`);

  const room = channel.slice(1);
  const args = [message.slice(1).split(" ")[1]];
  const isBroadcaster = tags.badges?.broadcaster === "1";
  const isMod = tags.mod;
  const isOwner = tags["user-id"] === FM_OWNER_ID;

  log.info("Command sent", { username: tags["display-name"], channel, command: args[0], args });

  // Commands for owner only
  if (isOwner) {
    if (args[0] === "ping") {
      client.say(room, `Pong imGlitch 👍`);
      return;
    }
    if (args[0] === "channels") {
      const channels = client.getChannels().map((channel) => channel.slice(1));
      client.say(room, `Connected channels: ${channels.join(", ")}`);
      return;
    }
    if (args[0] === "count") {
      const count = client.getChannels().length;
      client.say(room, `Connected channels: ${count}`);
      return;
    }
    if (args[0] === "random") {
      args[0] = songs[Math.floor(Math.random() * songs.length)];
    }
    if (args[0] === "ws") {
      // return count of connected websockets
      const count = await io.fetchSockets();
      client.say(room, `Connected ws: ${count.length}`);
      return;
    }

    if (args[0] === "set") {
      if (args[1] === "minviews") {
        SONG_MIN_VIEWS = Number(args[2]);
        client.say(room, `Minimum views set to ${SONG_MIN_VIEWS}`);
        return;
      }
      if (args[1] === "minlength") {
        SONG_MIN_LENGTH = Number(args[2]);
        client.say(room, `Minimum length set to ${SONG_MIN_LENGTH}`);
        return;
      }
      if (args[1] === "maxlength") {
        SONG_MAX_LENGTH = Number(args[2]);
        client.say(room, `Maximum length set to ${SONG_MAX_LENGTH}`);
        return;
      }
    }
    if (args[0] === "toggle") {
      if (args[1] === "topic") {
        SKIP_TOPIC = !SKIP_TOPIC;
        client.say(room, `Skip topic: ${SKIP_TOPIC}`);
        return;
      }
      if (args[1] === "song") {
        SONG_COMMAND = !SONG_COMMAND;
        client.say(room, `Song command: ${SONG_COMMAND}`);
        return;
      }
    }
    if (args[0] === "uptime") {
      var ut_sec = process.uptime();
      var ut_min = ut_sec / 60;
      var ut_hour = ut_min / 60;

      ut_sec = Math.floor(ut_sec);
      ut_min = Math.floor(ut_min);
      ut_hour = Math.floor(ut_hour);

      ut_hour = ut_hour % 60;
      ut_min = ut_min % 60;
      ut_sec = ut_sec % 60;

      client.say(room, `Uptime: ${ut_hour}h ${ut_min}m ${ut_sec}s`);
      return;
    }
  }

  // Commands for moderators
  if (isBroadcaster || isMod || isOwner) {
    if (args[0] === "pause") {
      redisClient
        .multi()
        .ttl(`${room}:current`)
        .persist(`${room}:current`)
        .exec((err, replies) => {
          const [ttlError, ttl] = replies[0] as any;
          const [currentError, current] = replies[1] as any;

          if (ttlError || currentError) {
            client.say(room, "Error while pausing");
            return;
          }

          if (ttl === -2) {
            client.say(room, "Nothing to pause");
            return;
          }

          if (ttl === -1) {
            client.say(room, "Song already paused");
            return;
          }

          log.info(`${room}:current`, { ttl, current });

          redisClient
            .set(`${room}:timeRemaining`, ttl)
            .then(() => {
              io.in(room).emit("pause");
              client.say(room, "Song paused");
            })
            .catch((err) => log.error(err));
        });
      return;
    } else if (args[0] === "play") {
      redisClient
        .multi()
        .get(`${room}:current`)
        .get(`${room}:timeRemaining`)
        .exec((err, replies) => {
          const [currentError, current] = replies[0] as any;
          const [timeRemainingError, timeRemaining] = replies[1] as any;
          // const [timeRemainingDelError, timeRemainingDel] = replies[2];

          if (currentError || timeRemainingError) {
            client.say(room, "Error while playing");
            return;
          }

          if (current === null) {
            client.say(room, "Nothing to play");
            return;
          }

          log.info("Time remaining", { timeRemaining });

          // if (timeRemainingDel === 1) {
          redisClient
            .expire(`${room}:current`, timeRemaining)
            .then(() => {
              io.in(room).emit("play");
              client.say(room, "Song playing");
            })
            .catch((err) => log.error(err));
          // }
        });
      return;
    } else if (args[0] === "skip") {
      await skipSong(room);
      return;
    } else if (args[0] === "clear") {
      redisClient
        .multi()
        .del(`${room}:current`)
        .del(`${room}:playlist`)
        .exec(() => {
          client.say(room, "Playlist cleared");
          io.in(room).emit("clear");
        })
        .catch((err) => log.error(err));
      return;
    } else if (args[0] === "help") {
      client.say(
        room,
        `@${tags["display-name"]} Available commands: <link>, help, play, pause, skip, clear, song, disconnect`
      );
      return;
    } else if (args[0] === "disconnect") {
      client.say(room, `@${tags["display-name"]}, disconnecting... :(`);
      client.part(room);
      return;
    } else if (args[0] === "ban") {
      const user = args[1];
      if (!user) {
        client.say(room, `@${tags["display-name"]}, please specify a user to ban`);
        return;
      }
      client.say(room, `@${tags["display-name"]}, ${user} banned`);
      return;
    } else if (args[0] === "unban") {
      const user = args[1];
      if (!user) {
        client.say(room, `@${tags["display-name"]}, please specify a user to unban`);
        return;
      }
      client.say(room, `@${tags["display-name"]}, ${user} unbanned`);
      return;
    }
  }

  // Commands for everyone
  if (args[0] === "help") {
    client.say(room, `@${tags["display-name"]}, available commands: !fm <link>, !fm search <term>, !fm song, !fm wrong`);
    return;
  }

  if (args[0] === "song") {
    redisClient
      .get(`${room}:current`)
      .then((current) => {
        if (current === null) {
          client.say(room, "Nothing playing");
          return;
        }

        const currentSong: CurrentSong = JSON.parse(current);

        client.say(room, `@${tags["display-name"]}, currently playing: "${currentSong.title}"`);
      })
      .catch((err) => log.error(err));
    return;
  }

  if (args[0] === "wrong") {
    const current = await redisClient.lrange(`${room}:playlist`, 0, -1);
    const list = current.map((item) => JSON.parse(item));

    if (list.length < 1) {
      client.say(room, `@${tags["display-name"]}, playlist empty`);
      return;
    }

    let found;

    for (let i = list.length - 1; i > -1; i--) {
      if (list[i].username === tags["display-name"]) {
        found = list[i];
        break;
      }
    }

    if (!found) {
      client.say(room, `@${tags["display-name"]}, could not find your last added song`);
      return;
    }

    redisClient.lrem(`${room}:playlist`, -1, JSON.stringify(found));

    client.say(room, `@${tags["display-name"]}, removed your last song`);
    return;
  }

  if (args[0] === "search") {
    const search = args.slice(1).join(" ");
    const searchResults = await ytsr(search);
    const vid = searchResults.items.find((item) => item.type === "video");
    if (vid.type === "video") {
      log.info("SEARCH", { vid });
      // client.say(room, `@${tags["display-name"]} ${vid.title}`);
      args[0] = vid.url;
    }
  }

  // Check if yt url is not valid
  const isNotValid = !ytdl.validateURL(args[0]);

  if (isNotValid) {
    client.say(channel, `@${tags["display-name"]}, command not valid`);
    return;
  }

  redisClient
    .lrange(`${room}:playlist`, 0, -1)
    .then(async (current) => {
      const list = current.map((item) => JSON.parse(item));

      const totalDuration = list.reduce((acc, item) => acc + item.duration, 0);

      const totalSongsByUser = list.filter((item) => item.username === tags["display-name"]).length;

      // Only add to queuq if the total playlist duration is less than the max duration
      if (totalDuration < ONE_HOUR) {
        if (totalSongsByUser >= 2) {
          client.say(channel, `@${tags["display-name"]}, you have reached the maximum amount of songs in queue`);
          return;
        }
        log.info("Number of songs for user: " + totalSongsByUser);
        log.info(`${tags["display-name"]} added ${args[0]} to the queue`);

        const url = args[0];
        const username = tags["display-name"];

        const id = ytdl.getVideoID(url);

        try {
          let info = await ytdl.getInfo(url);

          if (!(isBroadcaster || isMod || isOwner)) {
            if (Number(info.videoDetails.viewCount) < SONG_MIN_VIEWS) {
              log.info("Not enough views");
              client.say(room, `@${username}, not enough views`);
              return;
            }
            if (Number(info.videoDetails.lengthSeconds) < SONG_MIN_LENGTH) {
              log.info("Not long enough");
              client.say(room, `@${username}, song not long enough`);
              return;
            }
            if (Number(info.videoDetails.lengthSeconds) > SONG_MAX_LENGTH) {
              log.info("Too long");
              client.say(room, `@${username}, song too long`);
              return;
            }
          }

          if (SKIP_TOPIC) {
            if (info.videoDetails.author.name.toLowerCase().includes("topic")) {
              log.info("Topic song skipping");
              client.say(room, `@${username}, song type topic is not allowed try another link`);
              return;
            }
          }

          log.info(info.videoDetails.viewCount);

          let audioFormats = ytdl.filterFormats(info.formats, "videoandaudio");
          const format = ytdl.chooseFormat(audioFormats, {
            quality: "highest",
          });

          let song: Song = {
            yt_id: id,
            title: info.videoDetails.title,
            // title: info.videoDetails.media.song || info.videoDetails.title,
            artist: info.videoDetails.author.name,
            // artist: info.videoDetails.media.artist || info.videoDetails.author.name,
            url: format?.url,
            imgUrl: info.videoDetails.author.thumbnails?.at(-1)?.url,
            duration: Number(info.videoDetails.lengthSeconds),
          };

          // Cache the song
          // redisClient.setex(id, SONG_EXPIRATION, JSON.stringify(song));

          song = {
            ...song,
            username,
          };

          // Add song to playlist with redis multi
          redisClient
            .multi()
            .get(`${room}:current`)
            .lrange(`${room}:playlist`, 0, -1)
            .exec((err, replies) => {
              const current = replies[0][1] as any;
              const playlist = replies[1][1] as any;

              if (!current && playlist.length === 0) {
                redisClient.setex(`${room}:current`, song.duration, JSON.stringify(song));

                const temp: CurrentSong = {
                  ...song,
                  durationRemaining: song.duration,
                  isPlaying: true,
                };

                client.say(room, `@${username}, added https://www.youtube.com/watch?v=${id}`);
                //@ts-ignore
                io.in(room).emit("song", { current: temp, list });
              } else {
                redisClient.rpush(`${room}:playlist`, JSON.stringify(song));
                client.say(room, `@${username}, added https://www.youtube.com/watch?v=${id}`);
                io.in(room).emit("playlistAdd", song);
              }
            });
        } catch (error) {
          log.error(error);
          client.say(room, `@${username}, could not add song`);
        }
      } else {
        client.say(channel, `@${tags["display-name"]}, the playlist is full`);
      }
    })
    .catch((err) => log.error(err));
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
          .catch((err) => log.error(err));
      });
  }
});

async function connectToChannels() {
  const users = await User.find({ where: { channel: { isEnabled: true } } });

  if (!users) {
    log.info("No users found");
    return;
  }

  for (const user of users) {
    try {
      await client.join(user.username);
      log.info("Joined channel", { channel: user.username });
      await sleep(600);
    } catch (e) {
      log.info(e);
    }
  }
  log.warn("Connected to channels from database");
}

async function main() {
  try {
    await client.connect();
    await connectToChannels();
  } catch (e) {
    log.info("Eror in client conection");
    log.error(e);
  }

  io.on("connection", (socket) => {
    log.info("New connection", { id: socket.id });

    socket.on("error", (err) => {
      log.info("socket error", err);
    });

    socket.on("joinRoom", async (data) => {
      const is42fm = client.getChannels().includes(`#${data.room}`);

      if (!is42fm) {
        log.info(`Channel is not added`, { channel: data.room });
        socket.emit("no42fm");
        socket.disconnect();
        return;
      }

      log.info("Socket joined room", { socket: socket.id, room: data.room });
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
          const [ttlError, ttl] = replies[2];

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

          log.info(`${JSON.stringify(currentWithTTL)}`);

          if (current && playlist) {
            const list = playlist.map((item: string) => JSON.parse(item));
            socket.emit("song", { current: currentWithTTL, list });
          }
        });
    });

    socket.on("sync", ({ room }) => {
      log.info("Sync event", { room });
      redisClient
        .ttl(`${room}:current`)
        .then((ttl) => {
          if (ttl > 0) {
            log.debug(ttl);
            socket.emit("songSync", ttl);
          }
        })
        .catch((err) => log.error(err));
    });

    socket.on("couldNotLoad", async (room) => {
      const errors = await redisClient.incr(`${room}:errors`);
      await redisClient.expire(`${room}:errors`, 10);
      log.info("Errors", { room, errors });

      const sockets = await io.in(room).fetchSockets();

      const half = sockets.length / 2;

      log.info("Number of errors", { room, errors, half });
      if (errors > half) {
        client.say(room, "Skipping because could not load song");
        await redisClient.del(`${room}:errors`);
        await skipSong(room);
      }
    });
  });
}

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);

function skipSong(room: string) {
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

      log.debug("Skip", { current, nextSong });

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
          .catch((err) => log.error(err));
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
          .catch((err) => log.error(err));
      }
    });
}

// connection.initialize().then(() => {
//   console.clear();
//   log.info("Initialized connection to database");
//   connection.runMigrations().then(() => {
//     log.info("Ran migrations");
//     httpServer.listen(PORT, () => {
//       log.info(`🚀 Server started on port ${PORT}`);
//     });
//   });
// });

(async function () {
  await connection.initialize();
  log.info("Initialized connection to database");

  await connection.runMigrations();
  log.info("Ran migrations");

  main();

  httpServer.listen(PORT, () => {
    log.info(`🚀 Server started on port ${PORT}`);
  });
})();
