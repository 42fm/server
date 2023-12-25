import { config } from "@constants/config";
import { ONE_HOUR } from "@constants/constants";
import { limiter } from "@constants/limiter";
import { client } from "@constants/tmi";
import { youtubeApi } from "@constants/youtube";
import { redisClient } from "@db/redis";
import { Responder } from "@lib/responder";
import { Router } from "@lib/router";
import { logger } from "@utils/loggers";
import { parseTags } from "@utils/tagsParser";
import { parse, toSeconds } from "iso8601-duration";
import { ChatUserstate } from "tmi.js";
import ytdl from "ytdl-core";
import { io } from "../index";
import { prefixRouter } from "./prefix";

export const router = new Router();

const { COMMAND_PREFIX } = process.env;

router.register(`!${COMMAND_PREFIX}`, async (ctx, args) => {
  addSong(ctx, args);
});

router.registerNextRouter(`!${COMMAND_PREFIX}`, prefixRouter);

export async function addSong(
  {
    responder,
    room,
    tags,
  }: {
    responder: Responder;
    room: string;
    tags: ChatUserstate;
  },
  args: string[]
) {
  let url = args[0];

  // Check if yt url is not valid
  const isValid = ytdl.validateURL(url);

  console.log(url, isValid);

  if (!url) {
    responder.respondWithMention(`no link or search query provided`);
    return;
  }

  if (!isValid) {
    if (!args.length) {
      responder.respondWithMention(`no link or search query provided`);
      return;
    }

    const exceedsLimit = await limiter.consume(tags["user-id"]);

    if (exceedsLimit) {
      responder.respondWithMention("search ratelimit exceeded, use a link to add a song");
      return;
    }

    try {
      const response = await youtubeApi.search.list({
        part: ["snippet"],
        maxResults: 1,
        q: args.join(" "),
        key: process.env.GOOGLE_API_KEY,
      });

      url = `https://youtu.be/${response.data.items[0].id.videoId}`;
    } catch {
      responder.respondWithMention(`Unable to find video`);
      return;
    }
  }

  redisClient
    .lrange(`${room}:playlist`, 0, -1)
    .then(async (current) => {
      const list = current.map((item) => JSON.parse(item));

      const totalDuration = list.reduce((acc, item) => acc + item.duration, 0);

      const totalSongsByUser = list.filter((item) => item.username === tags["display-name"]).length;

      // Only add to queuq if the total playlist duration is less than the max duration
      if (totalDuration < ONE_HOUR * 2) {
        if (totalSongsByUser >= 2) {
          responder.respondWithMention("you have reached the maximum amount of songs in queue");
          return;
        }

        logger.info("Number of songs for user: " + totalSongsByUser);

        const username = tags["display-name"];

        const id = ytdl.getVideoID(url);

        try {
          const videoResponse = await youtubeApi.videos.list({
            part: ["contentDetails", "status", "snippet", "statistics"],
            id: [id],
            key: process.env.GOOGLE_API_KEY,
          });

          const item = videoResponse.data.items![0];

          const channelResponse = await youtubeApi.channels.list({
            part: ["snippet"],
            id: [item.snippet?.channelId],
            key: process.env.GOOGLE_API_KEY,
          });

          const isEmbeddable = item.status!.embeddable;
          const isAgeRestricted = item.contentDetails!.contentRating!.ytRating === "ytAgeRestricted";

          const title = item.snippet!.title!;
          const channelName = item.snippet!.channelTitle!;
          const views = Number(item.statistics!.viewCount);
          const duration = toSeconds(parse(item.contentDetails!.duration!));

          if (!isEmbeddable) {
            responder.respondWithMention("video has embedds disabled");
            return;
          }

          if (isAgeRestricted) {
            responder.respondWithMention("video is age restricted");
            return;
          }

          const { isBroadcaster, isMod, isOwner } = parseTags(tags);

          if (!(isBroadcaster || isMod || isOwner)) {
            if (views < config.get("SONG_MIN_VIEWS")) {
              logger.info("Not enough views");
              responder.respondWithMention(`song must have at least ${config.get("SONG_MIN_VIEWS")} views`);
              return;
            }
            if (duration < config.get("SONG_MIN_LENGTH")) {
              logger.info("Not long enough");
              responder.respondWithMention("song too short");
              return;
            }
            if (duration > config.get("SONG_MAX_LENGTH")) {
              logger.info("Too long");
              responder.respondWithMention("song too long");
              return;
            }
          }

          const song: Song = {
            yt_id: id,
            title,
            artist: channelName,
            url: "https://youtube.com/" + id,
            imgUrl: channelResponse.data.items![0].snippet?.thumbnails?.default?.url,
            duration,
            username,
          };

          // Add song to playlist with redis multi
          redisClient
            .multi()
            .get(`${room}:current`)
            .lrange(`${room}:playlist`, 0, -1)
            .exec((err, replies) => {
              const current = replies[0][1] as CurrentSong;
              const playlist = replies[1][1] as Song[];

              if (!current && playlist.length === 0) {
                redisClient.setex(`${room}:current`, song.duration, JSON.stringify(song));

                const temp: CurrentSong = {
                  ...song,
                  durationRemaining: song.duration,
                  isPlaying: true,
                };

                client.say(room, `@${username}, added https://www.youtube.com/watch?v=${id}`);
                io.in(room).emit("song", { current: temp, list });
              } else {
                redisClient.rpush(`${room}:playlist`, JSON.stringify(song));
                client.say(room, `@${username}, added https://www.youtube.com/watch?v=${id}`);
                io.in(room).emit("playlistAdd", song);
              }
            });
        } catch (error) {
          logger.error(error);
          client.say(room, `@${username}, could not add song`);
        }
      } else {
        responder.respondWithMention("playlist is full");
      }
    })
    .catch((err) => logger.error(err));
}
