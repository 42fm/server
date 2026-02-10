import { youtubeApi } from "@config/youtube.js";
import { SongManagerError } from "@lib/manager.js";
import { Temporal } from "@js-temporal/polyfill";

export async function getVideoInfo(id: string) {
  const videoResponse = await youtubeApi.videos.list({
    part: ["contentDetails", "status", "snippet", "statistics"],
    id: [id],
    key: process.env.GOOGLE_API_KEY,
    maxResults: 1,
  });

  const item = videoResponse.data.items![0];

  const channelResponse = await youtubeApi.channels.list({
    part: ["snippet"],
    id: [item.snippet!.channelId!],
    key: process.env.GOOGLE_API_KEY!,
    maxResults: 1,
  });

  const channelItem = channelResponse.data.items![0];

  const isEmbeddable = item.status!.embeddable;
  const isAgeRestricted = item.contentDetails!.contentRating!.ytRating === "ytAgeRestricted";
  const isNotVideo = item.snippet!.liveBroadcastContent !== "none";
  const isUnlisted = item.status?.privacyStatus === "unlisted";

  const title = item.snippet!.title!;
  const channelName = item.snippet!.channelTitle!;
  const views = Number(item.statistics!.viewCount);
  const duration = toSeconds(parse(item.contentDetails!.duration!));

  const thumbnail = channelItem.snippet!.thumbnails!.default!.url!;

  if (!isEmbeddable) {
    throw new SongManagerError("video has embedds disabled");
  }

  if (isAgeRestricted) {
    throw new SongManagerError("video is age restricted");
  }

  if (isNotVideo) {
    throw new SongManagerError("livestreams and upcoming videos are not supported");
  }

  if (isUnlisted) {
    throw new SongManagerError("unlisted videos are not supported");
  }

  return { views, duration, title, channelName, thumbnail };
}
