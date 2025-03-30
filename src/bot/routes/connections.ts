import { handleIrc, handleWs } from "@bot/controllers/connections.js";
import { Router } from "@lib/router.js";

export const connectionsRouter = new Router();

connectionsRouter.register("irc", handleIrc);
connectionsRouter.register("ws", handleWs);
