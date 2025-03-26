import {
  handleBan,
  handleChannels,
  handleClear,
  handleCount,
  handleDiconnect,
  handleHelp,
  handlePause,
  handlePing,
  handlePlay,
  handleRandom,
  handleSearch,
  handleSet,
  handleSkip,
  handleSong,
  handleTimer,
  handleUnban,
  handleUptime,
  handleVoteskip,
  handleWrong,
  handleWs,
} from "@bot/controllers/prefix.js";
import { checkIsPaused } from "@bot/middleware/checkIsPaused.js";
import { isOwner, isOwnerBroadcasterMod, isOwnerOrOwnerRoom } from "@bot/middleware/tags.js";
import { Router } from "@lib/router.js";
import { setRouter } from "./set.js";

export const prefixRouter = new Router();

prefixRouter.register("uptime", isOwner, handleUptime);
prefixRouter.register("channels", isOwner, handleChannels);
prefixRouter.register("count", isOwner, handleCount);
prefixRouter.register("random", isOwner, checkIsPaused, handleRandom);
prefixRouter.register("timer", isOwner, checkIsPaused, handleTimer);
prefixRouter.register("ws", isOwner, handleWs);
prefixRouter.register("ping", isOwnerOrOwnerRoom, handlePing);
prefixRouter.register("help", handleHelp);
prefixRouter.register("song", handleSong);
prefixRouter.register("wrong", handleWrong);
prefixRouter.register("clear", isOwnerBroadcasterMod, handleClear);
prefixRouter.register("disconnect", isOwnerBroadcasterMod, handleDiconnect);
prefixRouter.register("skip", isOwnerBroadcasterMod, checkIsPaused, handleSkip);
prefixRouter.register("play", isOwnerBroadcasterMod, handlePlay);
prefixRouter.register("pause", isOwnerBroadcasterMod, handlePause);
prefixRouter.register("set", isOwnerBroadcasterMod, handleSet);
prefixRouter.register("search", handleSearch);
prefixRouter.register("voteskip", checkIsPaused, handleVoteskip);
prefixRouter.register("ban", isOwnerBroadcasterMod, handleBan);
prefixRouter.register("unban", isOwnerBroadcasterMod, handleUnban);

prefixRouter.registerNextRouter("set", setRouter);
