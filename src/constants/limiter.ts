import RateLimiter from "@lib/limiter.js";
import { ONE_DAY_IN_SECONDS } from "./constants.js";

const { NODE_ENV } = process.env;

export const limiter = new RateLimiter({ max: NODE_ENV === "production" ? 10 : 3, time: ONE_DAY_IN_SECONDS / 2 });
