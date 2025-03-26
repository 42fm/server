import { handleMaxDuration, handleMinDuration, handleMinViews, handleStreamSync } from "@bot/controllers/set.js";
import { Router } from "@lib/router.js";

export const setRouter = new Router();

setRouter.register("minViews", handleMinViews);
setRouter.register("minDuration", handleMinDuration);
setRouter.register("maxDuration", handleMaxDuration);
setRouter.register("streamSync", handleStreamSync);
