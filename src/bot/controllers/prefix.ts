import { setRouter } from "@bot/routes/set.js";
import { client } from "@config/tmi.js";
import { Ban } from "@db/entity/Ban.js";
import { redisClient } from "@db/redis.js";
import { SongManagerError } from "@lib/manager.js";
import type { Context } from "@lib/router.js";
import { app } from "@root/index.js";
import { songs } from "@root/songs.js";
import { random } from "@root/utils/random.js";
import { getUser, GetUserError, type HelixUser } from "@utils/getUser.js";
import { logger } from "@utils/loggers.js";
import { QueryFailedError } from "typeorm";
import ytdl from "ytdl-core";

export function handleUptime(ctx: Context) {
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
}

export function handleChannels(ctx: Context) {
  const channels = client.getChannels().map((channel) => channel.slice(1));
  ctx.responder.respond(`Connected channels: ${channels.join(", ")}`);
}

export function handleCount(ctx: Context) {
  const count = client.getChannels().length;

  ctx.responder.respond(`Connected channels: ${count}`);
}

export function handleRandom({ room, tags, manager }: Context) {
  const song = songs[random(0, songs.length)];

  const id = ytdl.getURLVideoID(song);

  try {
    manager.add({
      id,
      room,
      tags,
    });
  } catch (err) {
    logger.error(err);
  }
}

export async function handleTimer({ room, tags, manager }: Context) {
  const id = "bj1JRuyYeco";

  try {
    await manager.add({
      id,
      room,
      tags,
    });
  } catch (err) {
    logger.error(err);
  }
}

export async function handleWs(ctx: Context) {
  const count = await app.io.fetchSockets();

  ctx.responder.respond(`Connected ws: ${count.length}`);
}

export function handlePing(ctx: Context) {
  ctx.responder.respond("Pong imGlitch 👍");
}

export function handleHelp(ctx: Context) {
  ctx.responder.respondWithMention(`available commands: !fm <link/id/title>, !fm song, !fm wrong, !fm voteskip`);
}

export async function handleSong({ responder, room, manager }: Context) {
  try {
    const current = await manager.getCurrent(room);

    if (!current) {
      responder.respondWithMention("Nothing is playing");
      return;
    }

    responder.respondWithMention(`Current song: https://youtu.be/${current.yt_id}`);
  } catch (e) {
    logger.error(e);
  }
}

export async function handleWrong({ responder, room, tags, manager }: Context) {
  const isPaused = await manager.isPaused(room);

  if (isPaused) {
    responder.respondWithMention("Cannot delete wrong song while paused");
    return;
  }

  const playlist = await manager.getPlaylist(room);

  if (playlist.length < 1) {
    responder.respondWithMention(`playlist empty`);
    return;
  }

  let found;

  for (let i = playlist.length - 1; i > -1; i--) {
    if (playlist[i].username === tags["username"]) {
      found = playlist[i];
      break;
    }
  }

  if (!found) {
    responder.respondWithMention(`could not find your last added song`);
    return;
  }

  redisClient.lrem(`${room}:playlist`, -1, JSON.stringify(found));

  responder.respondWithMention(`removed your last song`);
}

export async function handleClear(ctx: Context) {
  redisClient
    .multi()
    .del(`${ctx.room}:current`)
    .del(`${ctx.room}:playlist`)
    .exec(() => {
      ctx.responder.respond("Playlist cleared");
      app.io.in(ctx.room).emit("clear");
    })
    .catch((err) => logger.error(err));
}

export async function handleDiconnect(ctx: Context) {
  ctx.responder.respondWithMention(`disconnecting... :(`);
  client.part(ctx.room);
}

export async function handleSkip(ctx: Context) {
  try {
    ctx.manager.skip(ctx.room);
    ctx.responder.respondWithMention("skipping...");
  } catch (err) {
    if (err instanceof SongManagerError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("could not add song");
    }
  }
}

export function handlePlay(ctx: Context) {
  try {
    ctx.manager.play(ctx.room);
    ctx.responder.respondWithMention("Playing");
  } catch (err) {
    if (err instanceof SongManagerError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("Error while playing");
    }
  }
}

export function handlePause(ctx: Context) {
  try {
    ctx.manager.pause(ctx.room);
    ctx.responder.respondWithMention("Paused");
  } catch (err) {
    if (err instanceof SongManagerError) {
      ctx.responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      ctx.responder.respondWithMention("Error while pausing");
    }
  }
}

export function handleSet(ctx: Context) {
  ctx.responder.respondWithMention("available commands: " + Array.from(setRouter.routes.keys()).join(", "));
}

export function handleSearch(ctx: Context) {
  ctx.responder.respondWithMention("use !fm <link/title/id> to add a song");
}

export async function handleVoteskip(ctx: Context) {
  await redisClient.sadd(`${ctx.room}:votes`, ctx.tags["username"]!);

  let current;

  try {
    current = await ctx.manager.getCurrent(ctx.room);
  } catch (err) {
    logger.error(err);
    return;
  }

  if (!current) {
    ctx.responder.respondWithMention("nothing to skip");
    return;
  }

  const totalVotes = await redisClient.scard(`${ctx.room}:votes`);

  const sockets = await app.io.in(ctx.room).fetchSockets();

  const thresholdVotes = Math.ceil(sockets.length / 10);

  if (totalVotes >= thresholdVotes) {
    await redisClient.del(`${ctx.room}:votes`);
    ctx.manager.skip(ctx.room);
    ctx.responder.respond(`${totalVotes}/${thresholdVotes} votes, skipping...`);
  } else {
    ctx.responder.respond(`${totalVotes}/${thresholdVotes} votes`);
  }
}

export async function handleBan(ctx: Context, args: string[]) {
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
}

export async function handleUnban(ctx: Context, args: string[]) {
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
}
