import { config } from "@constants/config";
import { Router } from "@lib/router";

export const setRouter = new Router();

setRouter.register("min-views", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No views count provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  let prev = config.get("SONG_MIN_VIEWS");

  await config.set("SONG_MIN_VIEWS", num);

  ctx.responder.respond(`Minimum views changed from ${prev} to ${num}`);
});

setRouter.register("min-length", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No length provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  let prev = config.get("SONG_MIN_LENGTH");

  await config.set("SONG_MIN_LENGTH", num);

  ctx.responder.respond(`Minimum length changed from ${prev} to ${num}`);
});

setRouter.register("max-length", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No length provided");
    return;
  }

  const num = Number(args[0]);

  if (isNaN(num)) {
    ctx.responder.respond("Please provide a number");
    return;
  }

  let prev = config.get("SONG_MAX_LENGTH");

  await config.set("SONG_MAX_LENGTH", num);

  ctx.responder.respond(`Maximum length changed from ${prev} to ${num}`);
});
