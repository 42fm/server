import { handleCommand } from "@bot/controllers/index.js";
import { isBanned } from "@bot/middleware/isBanned.js";
import { Router } from "@lib/router.js";
import { prefixRouter } from "./prefix.js";

export const router = new Router();

const { COMMAND_PREFIX } = process.env;

router.register(`!${COMMAND_PREFIX}`, isBanned, handleCommand);

router.registerNextRouter(`!${COMMAND_PREFIX}`, prefixRouter);
