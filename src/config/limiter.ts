import { ONE_DAY_IN_SECONDS } from "@constants/time.js";
import RateLimiter from "@lib/limiter.js";

const { NODE_ENV } = process.env;

export const limiter = new RateLimiter({ max: NODE_ENV === "production" ? 20 : 10, time: ONE_DAY_IN_SECONDS / 2 });
