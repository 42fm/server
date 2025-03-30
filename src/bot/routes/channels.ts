import { handleAdd, handleDisable, handleEnable } from "@bot/controllers/channel.js";
import { Router } from "@lib/router.js";

export const channelsRouter = new Router();

channelsRouter.register("add", handleAdd);
channelsRouter.register("enable", handleEnable);
channelsRouter.register("disable", handleDisable);
