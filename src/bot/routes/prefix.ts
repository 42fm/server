import {
  handleBan,
  handleChannels,
  handleClear,
  handleDiconnect,
  handleHelp,
  handlePause,
  handlePing,
  handlePlay,
  handleRandom,
  handleSearch,
  handleSet,
  handleSkip,
  handleSockets,
  handleSong,
  handleTimer,
  handleUnban,
  handleUptime,
  handleVoteskip,
  handleWrong,
} from "@bot/controllers/prefix.js";
import { checkIsPaused } from "@bot/middleware/checkIsPaused.js";
import { isOwner, isOwnerBroadcasterMod, isOwnerOrOwnerRoom } from "@bot/middleware/tags.js";
import { Router } from "@lib/router.js";
import { channelsRouter } from "./channels.js";
import { setRouter } from "./set.js";

export const prefixRouter = new Router();

prefixRouter.register("channels", isOwner, handleChannels);
prefixRouter.register("random", isOwner, checkIsPaused, handleRandom);
prefixRouter.register("sockets", isOwner, handleSockets);
prefixRouter.register("timer", isOwner, checkIsPaused, handleTimer);
prefixRouter.register("uptime", isOwner, handleUptime);

prefixRouter.register("ping", isOwnerOrOwnerRoom, handlePing);

prefixRouter.register("ban", isOwnerBroadcasterMod, handleBan);
prefixRouter.register("clear", isOwnerBroadcasterMod, handleClear);
prefixRouter.register("disconnect", isOwnerBroadcasterMod, handleDiconnect);
prefixRouter.register("pause", isOwnerBroadcasterMod, handlePause);
prefixRouter.register("play", isOwnerBroadcasterMod, handlePlay);
prefixRouter.register("set", isOwnerBroadcasterMod, handleSet);
prefixRouter.register("skip", isOwnerBroadcasterMod, checkIsPaused, handleSkip);
prefixRouter.register("unban", isOwnerBroadcasterMod, handleUnban);

prefixRouter.register("help", handleHelp);
prefixRouter.register("search", handleSearch);
prefixRouter.register("song", handleSong);
prefixRouter.register("voteskip", checkIsPaused, handleVoteskip);
prefixRouter.register("wrong", handleWrong);

prefixRouter.registerNextRouter("channels", channelsRouter);
prefixRouter.registerNextRouter("set", setRouter);
