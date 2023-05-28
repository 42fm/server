import { youtube } from "@googleapis/youtube";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { parse, toSeconds } from "iso8601-duration";
import "reflect-metadata";
import { Server, ServerOptions } from "socket.io";
import tmi from "tmi.js";
import ytdl from "ytdl-core";
import ytsr from "ytsr";
import { User } from "./db/entity/User";
import connection from "./db/index";
import { redisClient, sub } from "./db/redis";
import morganMiddleware from "./middleware/morganMiddleware";
import auth from "./routes/auth";
import health from "./routes/health";
import { songs } from "./songs";
import { log } from "./utils/loggers";
import { Responder } from "./utils/reply";
import { sleep } from "./utils/sleep";

const youtubeApi = youtube({
  version: "v3",
});

let SONG_MIN_VIEWS = 10_000; // 15k views
let SONG_MIN_LENGTH = 60; // 1 minute
let SONG_MAX_LENGTH = 1200; // 20 minutes
let ONE_HOUR = 3600 * 2;
let SKIP_TOPIC = false;
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

const options: Partial<ServerOptions> = {
  cors: {
    origin: ["http://localhost:5713"],
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

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);

client.on("part", (channel, username, self) => {
  if (!self) return;
  log.debug(`Bot left channel: ${channel}`);
});

client.on("disconnected", (reason) => {
  // Do your stuff.
  log.debug("Got disconedted from the server", { reason });
});

client.on("reconnect", async () => {
  // Do your stuff.
  log.debug("Trying to reconnect to server");
  await connectToChannels();
});

// client.on("connected", async () => {
//   // Do your stuff.
//   log.debug("Connected to server");
//   await connectToChannels();
// });

client.on("serverchange", (channel) => {
  // Do your stuff.
  log.debug("Changed server", { channel });
});

client.on("message", async (channel, tags, message, self) => {
  // Ignore echoed messages and not valid commands
  if (self || !message.startsWith(`!${COMMAND_PREFIX}`)) return;

  log.info(`${tags["display-name"]} send a command on ${channel}`);

  const room = channel.slice(1);
  const args = [...message.split(" ")];
  let command = args[1];
  const isBroadcaster = tags.badges?.broadcaster === "1";
  const isMod = tags.mod;
  const isOwner = tags["user-id"] === FM_OWNER_ID;

  const responder = new Responder(client, tags, room);

  log.info("Command sent", { username: tags["display-name"], channel, command: command, args });

  // Commands for owner only
  if (isOwner) {
    if (command === "ping") {
      responder.respond("Pong imGlitch 👍");
      return;
    }
    if (command === "channels") {
      const channels = client.getChannels().map((channel) => channel.slice(1));
      responder.respond(`Connected channels: ${channels.join(", ")}`);
      return;
    }
    if (command === "count") {
      const count = client.getChannels().length;
      responder.respond(`Connected channels: ${count}`);
      return;
    }
    if (command === "random") {
      command = songs[Math.floor(Math.random() * songs.length)];
    }
    if (command === "ws") {
      // return count of connected websockets
      const count = await io.fetchSockets();
      responder.respond(`Connected ws: ${count.length}`);
      return;
    }

    if (command === "set") {
      if (args[2] === "minviews") {
        SONG_MIN_VIEWS = Number(args[3]);
        responder.respond(`Minimum views set to ${SONG_MIN_VIEWS}`);
        return;
      }
      if (args[2] === "minlength") {
        SONG_MIN_LENGTH = Number(args[3]);
        responder.respond(`Minimum length set to ${SONG_MIN_LENGTH}`);
        return;
      }
      if (args[2] === "maxlength") {
        SONG_MAX_LENGTH = Number(args[3]);
        responder.respond(`Maximum length set to ${SONG_MAX_LENGTH}`);
        return;
      }
    }
    if (command === "toggle") {
      if (args[2] === "topic") {
        SKIP_TOPIC = !SKIP_TOPIC;
        responder.respond(`Skip topic: ${SKIP_TOPIC}`);
        return;
      }
      if (args[2] === "song") {
        SONG_COMMAND = !SONG_COMMAND;
        responder.respond(`Song command: ${SONG_COMMAND}`);
        return;
      }
    }
    if (command === "uptime") {
      var ut_sec = process.uptime();
      var ut_min = ut_sec / 60;
      var ut_hour = ut_min / 60;

      ut_sec = Math.floor(ut_sec);
      ut_min = Math.floor(ut_min);
      ut_hour = Math.floor(ut_hour);

      ut_hour = ut_hour % 60;
      ut_min = ut_min % 60;
      ut_sec = ut_sec % 60;

      responder.respond(`Uptime: ${ut_hour}h ${ut_min}m ${ut_sec}s`);
      return;
    }
  }

  // Commands for moderators
  if (isBroadcaster || isMod || isOwner) {
    if (command === "pause") {
      redisClient
        .multi()
        .ttl(`${room}:current`)
        .persist(`${room}:current`)
        .exec((err, replies) => {
          const [ttlError, ttl] = replies[0] as any;
          const [currentError, current] = replies[1] as any;

          if (ttlError || currentError) {
            responder.respond("Error while pausing");
            return;
          }

          if (ttl === -2) {
            responder.respond("Nothing to pause");
            return;
          }

          if (ttl === -1) {
            responder.respond("Song already paused");
            return;
          }

          log.info(`${room}:current`, { ttl, current });

          redisClient
            .set(`${room}:timeRemaining`, ttl)
            .then(() => {
              io.in(room).emit("pause");
              responder.respond("Song paused");
            })
            .catch((err) => log.error(err));
        });
      return;
    } else if (command === "play") {
      redisClient
        .multi()
        .get(`${room}:current`)
        .get(`${room}:timeRemaining`)
        .exec((err, replies) => {
          const [currentError, current] = replies[0] as any;
          const [timeRemainingError, timeRemaining] = replies[1] as any;
          // const [timeRemainingDelError, timeRemainingDel] = replies[2];

          if (currentError || timeRemainingError) {
            responder.respond("Error while playing");
            return;
          }

          if (current === null) {
            responder.respond("Nothing to play");
            return;
          }

          log.info("Time remaining", { timeRemaining });

          // if (timeRemainingDel === 1) {
          redisClient
            .expire(`${room}:current`, timeRemaining)
            .then(() => {
              io.in(room).emit("play");
              responder.respond("Song playing");
            })
            .catch((err) => log.error(err));
          // }
        });
      return;
    } else if (command === "skip") {
      await skipSong(room);
      return;
    } else if (command === "clear") {
      redisClient
        .multi()
        .del(`${room}:current`)
        .del(`${room}:playlist`)
        .exec(() => {
          responder.respond("Playlist cleared");
          io.in(room).emit("clear");
        })
        .catch((err) => log.error(err));
      return;
    } else if (command === "help") {
      responder.respondWithMention(`Available commands: <link>, help, play, pause, skip, clear, song, disconnect`);
      return;
    } else if (command === "disconnect") {
      responder.respondWithMention(`disconnecting... :(`);
      client.part(room);
      return;
    } else if (command === "ban") {
      const user = args[1];
      if (!user) {
        responder.respondWithMention(`please specify a user to ban`);
        return;
      }
      responder.respondWithMention(`${user} banned`);
      return;
    } else if (command === "unban") {
      const user = args[1];
      if (!user) {
        responder.respondWithMention(`please specify a user to unban`);
        return;
      }
      responder.respondWithMention(`${user} unbanned`);
      return;
    }
  }

  // Commands for everyone
  if (command === "help") {
    responder.respondWithMention(`available commands: !fm <link>, !fm search <term>, !fm song, !fm wrong`);
    return;
  }

  if (command === "song") {
    redisClient
      .get(`${room}:current`)
      .then((current) => {
        if (current === null) {
          client.say(room, "Nothing playing");
          return;
        }

        const currentSong: CurrentSong = JSON.parse(current);

        responder.respondWithMention(`currently playing: "${currentSong.yt_id}"`);
      })
      .catch((err) => log.error(err));
    return;
  }

  if (command === "wrong") {
    const current = await redisClient.lrange(`${room}:playlist`, 0, -1);
    const list = current.map((item) => JSON.parse(item));

    if (list.length < 1) {
      responder.respondWithMention(`playlist empty`);
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
      responder.respondWithMention(`could not find your last added song`);
      return;
    }

    redisClient.lrem(`${room}:playlist`, -1, JSON.stringify(found));

    responder.respondWithMention(`removed your last song`);
    return;
  }

  if (command === "search") {
    const [_one, _two, ...search] = args;

    if (!search.length) {
      responder.respondWithMention(`no search query provided`);
      return;
    }

    try {
      const searchResults = await ytsr(search.join(" "));
      const vid = searchResults.items.find((item) => item.type === "video");
      if (vid!.type === "video") {
        log.info("SEARCH", { vid });
        command = vid.url;
      }
    } catch {
      responder.respondWithMention(`no search query provided`);
      return;
    }
  }

  // if (command === "spotify") {
  //   const [_one, _two, ...spotifyUrl] = args;

  //   responder.respondWithMention(`test`);

  //   console.log(spotifyUrl);
  //   return;
  // }

  // Check if yt url is not valid
  const isNotValid = !ytdl.validateURL(command);

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
        log.info(`${tags["display-name"]} added ${command} to the queue`);

        const url = command;
        const username = tags["display-name"];

        const id = ytdl.getVideoID(url);

        try {
          const response = await youtubeApi.videos.list({
            part: ["contentDetails", "status", "snippet", "statistics"],
            id: [id],
            key: process.env.GOOGLE_API_KEY,
          });

          let item = response.data.items![0];

          let isEmbeddable = item.status!.embeddable;
          let isAgeRestricted = item.contentDetails!.contentRating!.ytRating === "ytAgeRestricted";

          let title = item.snippet!.title!;
          let channelName = item.snippet!.channelTitle!;
          let views = Number(item.statistics!.viewCount);
          let duration = toSeconds(parse(item.contentDetails!.duration!));

          if (!isEmbeddable) {
            responder.respondWithMention("video has embedds disabled");
            return;
          }

          if (isAgeRestricted) {
            responder.respondWithMention("video is age restricted");
            return;
          }

          if (!(isBroadcaster || isMod || isOwner)) {
            if (views < SONG_MIN_VIEWS) {
              log.info("Not enough views");
              responder.respondWithMention("song doesn't have enough views");
              return;
            }
            if (duration < SONG_MIN_LENGTH) {
              log.info("Not long enough");
              responder.respondWithMention("song too short");
              return;
            }
            if (duration > SONG_MAX_LENGTH) {
              log.info("Too long");
              responder.respondWithMention("song too long");
              return;
            }
          }

          // // let audioFormats = ytdl.filterFormats(info.formats, "videoandaudio");
          // // const format = ytdl.chooseFormat(audioFormats, {
          // //   quality: "highest",
          // // });

          // let song: Song = {
          //   yt_id: id,
          //   title: info.videoDetails.title,
          //   artist: info.videoDetails.author.name,
          //   url: format?.url ?? "xd",
          //   imgUrl: info.videoDetails.author.thumbnails[info.videoDetails.author.thumbnails.length - 1].url,
          //   duration: Number(info.videoDetails.lengthSeconds),
          // };

          // Cache the song
          // redisClient.setex(id, SONG_EXPIRATION, JSON.stringify(song));

          let song: Song = {
            yt_id: id,
            title,
            artist: channelName,
            url: "https://youtube.com/" + id,
            imgUrl: null,
            // "https://static-cdn.jtvnw.net/jtv_user_pictures/c8f064a7-364f-460c-b668-75beb734e3aa-profile_image-70x70.png",
            duration,
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
  try {
    const users = await User.find({ where: { channel: { isEnabled: true } } });

    if (!users) {
      log.info("No users found");
      return;
    }

    for (const user of users) {
      try {
        await client.join(user.username);
        log.info("Joined channel", { channel: user.username });
        await sleep(2000);
      } catch (e) {
        log.info(e);
      }
    }
    log.debug("Connected to channels from database");
  } catch (e) {
    log.info("Error while connecting to channels");
    log.error(e);
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
    log.info("Error in client conection");
    log.error(e);
  }

  if (process.env.NODE_ENV === "development") {
    let user = await User.findOne({ where: { twitch_id: "36768120" } });

    if (!user) {
      let newUser = User.create({
        twitch_id: "36768120",
        username: "loczuk",
        display_name: "Loczuk",
        email: "test@test.com",
      });

      await newUser.save();
    }
  }

  io.on("connection", (socket) => {
    log.info("New connection", { id: socket.id, ip: socket.handshake.address });

    socket.on("error", (err) => {
      log.info("socket error", err);
    });

    socket.on("joinRoom", async (data) => {
      // if (!data.room) {
      //   log.info(`Channel not provided`);
      //   socket.emit("no42fm");
      //   return;
      // }

      const user = await User.findOne({ where: { username: data.room } });

      if (!user) {
        log.info("42fm not enabled on channel", { channel: data.room });
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
