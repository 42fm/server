import { Queue } from "@lib/queue.js";

const { NODE_ENV } = process.env;

// https://dev.twitch.tv/docs/chat/#rate-limits
export const queue = new Queue({
  limitPerInterval: NODE_ENV === "production" ? 20 : 5,
  reseltLimitMs: 30_000,
});
