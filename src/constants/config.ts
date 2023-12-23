import { Config } from "@lib/config";

const config = new Config({
  SONG_MIN_VIEWS: 10_000,
  SONG_MIN_LENGTH: 60,
  SONG_MAX_LENGTH: 1_200,
});

export { config };
