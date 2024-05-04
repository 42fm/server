import { ONE_HOUR } from "@constants/constants.js";
import { limiter } from "@constants/limiter.js";
import { songManager } from "@constants/manager.js";
import { youtubeApi } from "@constants/youtube.js";
import { redisClient } from "@db/redis.js";
import { SongManagerError } from "@lib/manager.js";
import { Router } from "@lib/router.js";
import { isBanned } from "@middleware/isBanned.js";
import { logger } from "@utils/loggers.js";
import ytdl from "ytdl-core";
import { prefixRouter } from "./prefix.js";

export const router = new Router();

const { COMMAND_PREFIX } = process.env;

router.register(`!${COMMAND_PREFIX}`, isBanned, async ({ responder, room, tags }, args) => {
  const input = args[0];

  let id: string;

  if (!input || args.length === 0 || input.length < 2) {
    responder.respondWithMention("no link or search query provided");
    return;
  }

  const current = await redisClient.lrange(`${room}:playlist`, 0, -1);

  const list = current.map((item) => JSON.parse(item));

  const totalDuration = list.reduce((acc, item) => acc + item.duration, 0);

  const totalSongsByUser = list.filter((item) => item.username === tags["username"]).length;

  logger.info(`Total songs by user: ${totalSongsByUser}`);
  // Only add to queuq if the total playlist duration is less than the max duration
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

  try {
    await songManager.add({
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
});

router.registerNextRouter(`!${COMMAND_PREFIX}`, prefixRouter);
