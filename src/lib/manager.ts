import { youtubeApi } from "@constants/youtube.js";
import { User } from "@db/entity/User.js";
import { redisClient } from "@db/redis.js";
import { logger } from "@utils/loggers.js";
import { parseTags } from "@utils/tagsParser.js";
import { parse, toSeconds } from "iso8601-duration";
import { ChatUserstate } from "tmi.js";
import { io } from "../index.js";

/**
 * The purpose of this custom error is to catch them later and display the message to the user, but in case of a regular error we don't want to display anything.
 */
export class SongManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SongManagerError";
  }
}

export class SongManager {
  /**
   * Adds a song with the given id to a specific room
   */
  async add({ id, room, tags }: { id: string; room: string; tags: ChatUserstate }) {
    const videoResponse = await youtubeApi.videos.list({
      part: ["contentDetails", "status", "snippet", "statistics"],
      id: [id],
      key: process.env.GOOGLE_API_KEY,
    });

    const item = videoResponse.data.items![0];

    const channelResponse = await youtubeApi.channels.list({
      part: ["snippet"],
      id: [item.snippet!.channelId!],
      key: process.env.GOOGLE_API_KEY!,
    });

    const isEmbeddable = item.status!.embeddable;
    const isAgeRestricted = item.contentDetails!.contentRating!.ytRating === "ytAgeRestricted";
    const isNotVideo = item.snippet!.liveBroadcastContent !== "none";

    const title = item.snippet!.title!;
    const channelName = item.snippet!.channelTitle!;
    const views = Number(item.statistics!.viewCount);
    const duration = toSeconds(parse(item.contentDetails!.duration!));

    if (!isEmbeddable) {
      throw new SongManagerError("video has embedds disabled");
    }

    if (isAgeRestricted) {
      throw new SongManagerError("video is age restricted");
    }

    if (isNotVideo) {
      throw new SongManagerError("livestreams and upcoming videos are not supported");
    }

    const user = await User.findOne({
      select: {
        settings: {
          maxDuration: true,
          minDuration: true,
          minViews: true,
        },
      },
      where: { username: room },
      relations: {
        settings: true,
      },
    });

    if (!user) {
      throw new SongManagerError("user not found");
    }

    const { isBroadcaster, isMod, isOwner } = parseTags(tags);

    if (!(isBroadcaster || isMod || isOwner)) {
      if (views < user.settings.minViews) {
        throw new SongManagerError(`song must have at least ${user.settings.minViews} views`);
      }
      if (duration < user.settings.minDuration) {
        throw new SongManagerError(`video must be at least ${user.settings.minDuration} seconds long`);
      }
      if (duration > user.settings.maxDuration) {
        throw new SongManagerError(`song too long, max duration is ${user.settings.maxDuration} seconds`);
      }
    }

    const song: Song = {
      yt_id: id,
      title,
      artist: channelName,
      url: "https://youtube.com/" + id,
      imgUrl: channelResponse.data.items![0].snippet!.thumbnails!.default!.url!,
      duration,
      username: tags["username"]!,
    };

    // Add song to playlist with redis multi
    redisClient
      .multi()
      .get(`${room}:current`)
      .lrange(`${room}:playlist`, 0, -1)
      .exec((err, replies) => {
        const current = replies![0][1] as CurrentSong;
        const playlist = replies![1][1] as Song[];

        if (!current && playlist.length === 0) {
          redisClient.setex(`${room}:current`, song.duration, JSON.stringify(song));

          const temp: CurrentSong = {
            ...song,
            durationRemaining: song.duration,
            isPlaying: true,
          };

          io.in(room).emit("song", { current: temp, list: playlist });
        } else {
          redisClient.rpush(`${room}:playlist`, JSON.stringify(song));
          io.in(room).emit("playlistAdd", song);
        }
      });
  }

  /**
   * Skips the current song in a given room
   * @param room
   */
  skip(room: string) {
    return redisClient
      .multi()
      .get(`${room}:current`)
      .lpop(`${room}:playlist`)
      .exec((err, replies) => {
        const [currentError, current] = replies![0] as [Error, string];
        const [nextSongError, nextSong] = replies![1] as [Error, string];

        if (currentError || nextSongError) {
          throw new SongManagerError("Error while skipping");
        }

        logger.debug("Skip", { current, nextSong });

        if (current === null) {
          throw new SongManagerError("Nothing to skip");
        }

        // if there is a current song return the next song or return null?
        if (nextSong === null) {
          redisClient
            .del(`${room}:current`)
            .then(() => {
              io.in(room).emit("skip", { type: "noplaylist" });
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

  async pause(room: string) {
    const ttl = await redisClient.ttl(`${room}:current`);
    await redisClient.persist(`${room}:current`);

    if (ttl === -2) {
      throw new SongManagerError("Nothing to pause");
    }

    if (ttl === -1) {
      throw new SongManagerError("Song already paused");
    }

    await redisClient.set(`${room}:timeRemaining`, ttl);
    await redisClient.set(`${room}:paused`, "true");

    io.in(room).emit("pause");
  }

  async play(room: string) {
    const current = await redisClient.get(`${room}:current`);
    const timeRemaining = await redisClient.getdel(`${room}:timeRemaining`);

    logger.info("current", { current, timeRemaining });

    if (current === null) {
      throw new SongManagerError("Nothing to play");
    }

    if (timeRemaining === null) {
      throw new SongManagerError("Song already playing");
    }

    await redisClient.expire(`${room}:current`, timeRemaining);
    await redisClient.del(`${room}:paused`);
    io.in(room).emit("play");
  }
}
