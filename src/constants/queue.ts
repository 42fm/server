import { Queue } from "@lib/queue.js";

const { NODE_ENV } = process.env;

export const queue = new Queue({
  limitPerInterval: NODE_ENV === "production" ? 30 : 5,
  reseltLimitMs: 30_000,
});
