import { Router } from "@lib/router";

export const setRouter = new Router();

setRouter.register("views", (ctx, args) => {
  console.log("views", args);
});

setRouter.register("length", (ctx) => {
  console.log("length");
});
