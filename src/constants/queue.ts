import { Queue } from "@lib/queue.js";

const { NODE_ENV } = process.env;

export const queue = new Queue({
  limit: NODE_ENV === "production" ? 30 : 5,
  intervalMs: 30_000,
});
