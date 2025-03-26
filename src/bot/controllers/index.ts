import { ONE_HOUR } from "@constants/constants.js";
import { limiter } from "@constants/limiter.js";
import { youtubeApi } from "@constants/youtube.js";
import { SongManagerError } from "@lib/manager.js";
import { type Context } from "@lib/router.js";
import { app } from "@root/index.js";
import { logger } from "@utils/loggers.js";
import ytdl from "ytdl-core";

export async function handleCommand({ responder, room, tags, manager }: Context, args: string[]) {
  const input = args[0];

  let id: string;

  if (!input || args.length === 0 || args.join("").length <= 3) {
    responder.respondWithMention("Use !fm <link/query/id> to add a song");
    return;
  }

  if (await app.manager[room].isPaused(room)) {
    responder.respondWithMention("Cannot add song while paused");
    return;
  }

  const list = await manager.getPlaylist(room);

  const totalDuration = list.reduce((acc, item) => acc + item.duration, 0);

  const totalSongsByUser = list.filter((item) => item.username === tags["username"]).length;

  logger.info(`Total songs by user: ${totalSongsByUser}`);

  if (totalSongsByUser >= 5) {
    responder.respondWithMention("you have reached the maximum amount of songs in queue");
    return;
  }

  if (totalDuration > ONE_HOUR * 2) {
    responder.respondWithMention("playlist is full");
    return;
  }

  if (ytdl.validateURL(input)) {
    id = ytdl.getURLVideoID(input);
  } else if (ytdl.validateID(input)) {
    id = ytdl.getVideoID(input);
  } else {
    const exceedsLimit = await limiter.consume(tags["user-id"]!);

    if (exceedsLimit) {
      responder.respondWithMention("search ratelimit exceeded, use a link to add a song");
      return;
    }

    try {
      const response = await youtubeApi.search.list({
        part: ["snippet"],
        type: ["video"],
        maxResults: 1,
        q: args.join(" "),
        key: process.env.GOOGLE_API_KEY,
      });

      id = response.data.items![0].id!.videoId!;
    } catch {
      responder.respondWithMention("unable to find video");
      return;
    }
  }

  const duplicate = list.find((song) => song.yt_id == id);

  if (duplicate) {
    responder.respondWithMention("song already added");
    return;
  }

  try {
    await manager.add({
      id,
      room,
      tags,
    });
    responder.respondWithMention(`added https://youtu.be/${id}`);
  } catch (err) {
    if (err instanceof SongManagerError) {
      responder.respondWithMention(err.message);
    } else {
      logger.error(err);
      responder.respondWithMention("could not add song");
    }
  }
}
