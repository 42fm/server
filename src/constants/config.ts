import { Config } from "@lib/config.js";

const config = new Config({
  SONG_MIN_VIEWS: 5_000,
  SONG_MIN_LENGTH: 30,
  SONG_MAX_LENGTH: 1_200,
});

export { config };
