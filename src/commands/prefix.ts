import { songManager } from "@constants/manager.js";
import { client } from "@constants/tmi.js";
import { Ban } from "@db/entity/Ban.js";
import { redisClient } from "@db/redis.js";
import { SongManagerError } from "@lib/manager.js";
import { Router } from "@lib/router.js";
import { checkIsPaused } from "@middleware/checkIsPaused.js";
import { isOwner, isOwnerBroadcasterMod, isOwnerOrOwnerRoom } from "@middleware/tags.js";
import { GetUserError, HelixUser, getUser } from "@utils/getUser.js";
import { logger } from "@utils/loggers.js";
import { QueryFailedError } from "typeorm";
import ytdl from "ytdl-core";
import { io } from "../index.js";
import { songs } from "../songs.js";
import { setRouter } from "./set.js";

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

prefixRouter.register("random", isOwner, checkIsPaused, ({ room, tags }) => {
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

prefixRouter.register("song", checkIsPaused, async ({ responder, room }) => {
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
  const isPaused = await redisClient.get(`${room}:paused`);

  if (isPaused) {
    responder.respondWithMention("Cannot delete wrong song while paused");
    return;
  }

  const current = await redisClient.lrange(`${room}:playlist`, 0, -1);
  const list = current.map((item) => JSON.parse(item));

  if (list.length < 1) {
    responder.respondWithMention(`playlist empty`);
    return;
  }

  let found;

  for (let i = list.length - 1; i > -1; i--) {
    if (list[i].username === tags["username"]) {
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
  try {
    await songManager.play(ctx.room);
    ctx.responder.respondWithMention("Playing");
  } catch (err) {
    if (err instanceof SongManagerError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("Error while playing");
    }
  }
});

prefixRouter.register("pause", isOwnerBroadcasterMod, async (ctx) => {
  songManager
    .pause(ctx.room)
    .then(() => {
      ctx.responder.respondWithMention("Paused");
    })
    .catch((err) => {
      if (err instanceof SongManagerError) {
        ctx.responder.respondWithMention(err.message);
      } else {
        logger.error(err);
        ctx.responder.respondWithMention("error while pausing");
      }
    });
});

prefixRouter.register("set", isOwnerBroadcasterMod, (ctx) => {
  ctx.responder.respondWithMention("available commands: " + Array.from(setRouter.routes.keys()).join(", "));
});

prefixRouter.register("search", (ctx) => {
  ctx.responder.respondWithMention("use !fm <link/title/id> to add a song");
});

prefixRouter.register("voteskip", checkIsPaused, async (ctx) => {
  await redisClient.sadd(`${ctx.room}:votes`, ctx.tags["username"]!);

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

prefixRouter.register("ban", isOwnerBroadcasterMod, async (ctx, args) => {
  let user: HelixUser | undefined;

  try {
    user = await getUser(args[0]);
  } catch (err) {
    if (err instanceof GetUserError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("Could not get user");
    }
    return;
  }

  try {
    await Ban.insert({
      user_twitch_id: user.id,
      channel_twitch_id: ctx.tags["room-id"],
    });
    logger.info("user banned");
    ctx.responder.respondWithMention("user has been banned");
  } catch (err) {
    if (err instanceof QueryFailedError) {
      ctx.responder.respondWithMention("user has already been banned");
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("error while banning");
    }
  }
});

prefixRouter.register("unban", isOwnerBroadcasterMod, async (ctx, args) => {
  let user: HelixUser | undefined;

  try {
    user = await getUser(args[0]);
  } catch (err) {
    if (err instanceof GetUserError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("Could not get user");
    }
    return;
  }

  if (!user) {
    ctx.responder.respondWithMention("User not found");
    return;
  }

  const ban = await Ban.findOne({ where: { channel_twitch_id: ctx.tags["room-id"], user_twitch_id: user.id } });

  if (!ban) {
    ctx.responder.respondWithMention("User is not banned");
    return;
  }

  await ban.remove();

  ctx.responder.respondWithMention("User has been unbanned");
});

prefixRouter.registerNextRouter("set", setRouter);
