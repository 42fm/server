import { songManager } from "@constants/manager";
import { SongManagerError } from "@lib/manager";
import { songs } from "songs";
import ytdl from "ytdl-core";
import { client } from "../constants/tmi";
import { redisClient } from "../db/redis";
import { io } from "../index";
import { Router } from "../lib/router";
import { isOwner, isOwnerBroadcasterMod, isOwnerOrOwnerRoom } from "../middleware/tags";
import { logger } from "../utils/loggers";
import { setRouter } from "./set";

export const prefixRouter = new Router();

prefixRouter.register("uptime", isOwner, (ctx) => {
  let ut_sec = process.uptime();
  let ut_min = ut_sec / 60;
  let ut_hour = ut_min / 60;

  ut_sec = Math.floor(ut_sec);
  ut_min = Math.floor(ut_min);
  ut_hour = Math.floor(ut_hour);

  ut_hour = ut_hour % 60;
  ut_min = ut_min % 60;
  ut_sec = ut_sec % 60;

  ctx.responder.respond(`Uptime: ${ut_hour}h ${ut_min}m ${ut_sec}s MrDestructoid`);
});

prefixRouter.register("channels", isOwner, (ctx) => {
  const channels = client.getChannels().map((channel) => channel.slice(1));
  ctx.responder.respond(`Connected channels: ${channels.join(", ")}`);
});

prefixRouter.register("count", isOwner, (ctx) => {
  const count = client.getChannels().length;

  ctx.responder.respond(`Connected channels: ${count}`);
});

prefixRouter.register("random", isOwner, ({ room, tags }) => {
  const song = songs[Math.floor(Math.random() * songs.length)];

  const id = ytdl.getURLVideoID(song);

  songManager.add({
    id,
    room,
    tags,
  });
});

prefixRouter.register("ws", isOwner, async (ctx) => {
  const count = await io.fetchSockets();

  ctx.responder.respond(`Connected ws: ${count.length}`);
});

prefixRouter.register("ping", isOwnerOrOwnerRoom, (ctx) => {
  ctx.responder.respond("Pong imGlitch 👍");
});

prefixRouter.register("help", (ctx) => {
  ctx.responder.respondWithMention(`available commands: !fm <link/id/title>, !fm song, !fm wrong, !fm voteskip`);
});

prefixRouter.register("song", async ({ responder, room }) => {
  try {
    const res = await redisClient.get(`${room}:current`);

    if (!res) {
      responder.respondWithMention("Nothing is playing");
      return;
    }

    const currentSong: CurrentSong = JSON.parse(res);

    responder.respondWithMention(`Current song: https://youtu.be/${currentSong.yt_id}`);
  } catch (e) {
    logger.error(e);
  }
});

prefixRouter.register("wrong", async ({ responder, room, tags }) => {
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
});

prefixRouter.register("clear", isOwnerBroadcasterMod, async (ctx) => {
  redisClient
    .multi()
    .del(`${ctx.room}:current`)
    .del(`${ctx.room}:playlist`)
    .exec(() => {
      ctx.responder.respond("Playlist cleared");
      io.in(ctx.room).emit("clear");
    })
    .catch((err) => logger.error(err));
});

prefixRouter.register("disconnect", isOwnerBroadcasterMod, async (ctx) => {
  ctx.responder.respondWithMention(`disconnecting... :(`);
  client.part(ctx.room);
});

prefixRouter.register("skip", isOwnerBroadcasterMod, async (ctx) => {
  try {
    await songManager.skip(ctx.room);
    ctx.responder.respondWithMention("skipping...");
  } catch (err) {
    if (err instanceof SongManagerError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("could not add song");
    }
  }
});

prefixRouter.register("play", isOwnerBroadcasterMod, async (ctx) => {
  redisClient
    .multi()
    .get(`${ctx.room}:current`)
    .get(`${ctx.room}:timeRemaining`)
    .exec((err, replies) => {
      const [currentError, current] = replies[0] as [Error, CurrentSong];
      const [timeRemainingError, timeRemaining] = replies[1] as [Error, number];

      if (currentError || timeRemainingError) {
        ctx.responder.respond("Error while playing");
        return;
      }

      if (current === null) {
        ctx.responder.respond("Nothing to play");
        return;
      }

      logger.info("Time remaining", { timeRemaining });

      redisClient
        .expire(`${ctx.room}:current`, timeRemaining)
        .then(() => {
          io.in(ctx.room).emit("play");
          ctx.responder.respond("Song playing");
        })
        .catch((err) => logger.error(err));
    });
});

prefixRouter.register("pause", isOwnerBroadcasterMod, async (ctx) => {
  redisClient
    .multi()
    .ttl(`${ctx.room}:current`)
    .persist(`${ctx.room}:current`)
    .exec((err, replies) => {
      const [ttlError, ttl] = replies[0] as [Error, number];
      const [currentError, current] = replies[1] as [Error, CurrentSong];

      if (ttlError || currentError) {
        ctx.responder.respond("Error while pausing");
        return;
      }

      if (ttl === -2) {
        ctx.responder.respond("Nothing to pause");
        return;
      }

      if (ttl === -1) {
        ctx.responder.respond("Song already paused");
        return;
      }

      logger.info(`${ctx.room}:current`, { ttl, current });

      redisClient
        .set(`${ctx.room}:timeRemaining`, ttl)
        .then(() => {
          io.in(ctx.room).emit("pause");
          ctx.responder.respond("Song paused");
        })
        .catch((err) => logger.error(err));
    });
});

prefixRouter.register("set", isOwner, (ctx) => {
  ctx.responder.respondWithMention("available commands: " + Array.from(setRouter.routes.keys()).join(", "));
});

prefixRouter.register("search", (ctx) => {
  ctx.responder.respondWithMention("use !fm <link/title/id> to add a song");
});

prefixRouter.register("voteskip", async (ctx) => {
  await redisClient.sadd(`${ctx.room}:votes`, ctx.tags["username"]);

  let current;

  try {
    current = await redisClient.get(`${ctx.room}:current`);
  } catch (err) {
    logger.error(err);
    return;
  }

  if (!current) {
    ctx.responder.respondWithMention("nothing to skip");
    return;
  }

  const totalVotes = await redisClient.scard(`${ctx.room}:votes`);

  const sockets = await io.in(ctx.room).fetchSockets();

  const thresholdVotes = Math.ceil(sockets.length / 10);

  if (totalVotes >= thresholdVotes) {
    await redisClient.del(`${ctx.room}:votes`);
    await songManager.skip(ctx.room);
    ctx.responder.respond(`${totalVotes}/${thresholdVotes} votes, skipping...`);
  } else {
    ctx.responder.respond(`${totalVotes}/${thresholdVotes} votes`);
  }
});

prefixRouter.registerNextRouter("set", setRouter);
