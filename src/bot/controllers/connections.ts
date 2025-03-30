import { client } from "@config/tmi.js";
import type { Context } from "@lib/router.js";
import { app } from "@root/index.js";

export function handleIrc(ctx: Context) {
  const count = client.getChannels().length;

  ctx.responder.respond(`Connected channels: ${count}`);
}

export async function handleWs(ctx: Context) {
  const count = await app.io.fetchSockets();

  ctx.responder.respond(`Connected sockets: ${count.length}`);
}
