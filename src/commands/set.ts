import { User } from "@db/entity/User.js";
import { Router } from "@lib/router.js";

export const setRouter = new Router();

setRouter.register("minViews", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No views count provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  const user = await User.findOne({
    where: {
      username: ctx.room,
    },
    relations: {
      settings: true,
    },
  });

  user.settings.minViews = num;

  await user.settings.save();

  ctx.responder.respond(`Minimum views changed to ${num} views`);
});

setRouter.register("minDuration", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No length provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  const user = await User.findOne({
    where: {
      username: ctx.room,
    },
    relations: {
      settings: true,
    },
  });

  user.settings.minDuration = num;

  await user.settings.save();

  ctx.responder.respond(`Minimum duration changed to ${num} seconds`);
});

setRouter.register("maxDuration", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No length provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  const user = await User.findOne({
    where: {
      username: ctx.room,
    },
    relations: {
      settings: true,
    },
  });

  user.settings.maxDuration = num;

  await user.settings.save();

  ctx.responder.respond(`Maximum duration changed to ${num} seconds`);
});

setRouter.register("streamSync", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No length provided");
    return;
  }

  if (args[0].toLowerCase() !== "true" && args[0].toLowerCase() !== "false") {
    ctx.responder.respond("Please provide a true or false value");
    return;
  }

  const bool = args[0].toLowerCase() === "true";

  const user = await User.findOne({
    where: {
      username: ctx.room,
    },
    relations: {
      settings: true,
    },
  });

  user.settings.streamSync = bool;

  await user.settings.save();

  ctx.responder.respond(`Changed stream sync to ${bool}`);
});
