import { redisClient } from "@db/redis.js";
import { Router } from "@lib/router.js";
import { getUserWithSettings } from "@services/user.js";
import { getAppAccessToken } from "@utils/appAccessToken.js";
import axios from "axios";

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

  const user = await getUserWithSettings(ctx.room);

  if (!user) {
    ctx.responder.respond("User not found");
    return;
  }

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

  const user = await getUserWithSettings(ctx.room);

  if (!user) {
    ctx.responder.respond("User not found");
    return;
  }

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

  const user = await getUserWithSettings(ctx.room);

  if (!user) {
    ctx.responder.respond("User not found");
    return;
  }

  user.settings.maxDuration = num;

  await user.settings.save();

  ctx.responder.respond(`Maximum duration changed to ${num} seconds`);
});

setRouter.register("streamSync", async (ctx, args) => {
  if (args[0] === undefined) {
    ctx.responder.respond("No value provided");
    return;
  }

  if (args[0].toLowerCase() !== "true" && args[0].toLowerCase() !== "false") {
    ctx.responder.respond("Please provide a true or false value");
    return;
  }

  const bool = args[0].toLowerCase() === "true";

  const user = await getUserWithSettings(ctx.room);

  if (!user) {
    ctx.responder.respond("User not found");
    return;
  }

  const token = await getAppAccessToken();

  if (!token) {
    ctx.responder.respond("Unable to get app access token");
    return;
  }

  if (bool) {
    if (!user.settings.streamSync) {
      await subscribeToStream(user.twitch_id, ctx.room, token);

      user.settings.streamSync = true;

      await user.settings.save();

      ctx.responder.respond(`Changed stream sync to ${bool}`);
    } else {
      ctx.responder.respond("Already subscribed to stream");
    }
  } else {
    if (user.settings.streamSync) {
      const streamOnlineId = await redisClient.get(`${ctx.room}:stream-online`);
      const streamOfflineId = await redisClient.get(`${ctx.room}:stream-offline`);

      if (streamOnlineId) {
        await deleteSubscription(streamOnlineId, token);
      }

      if (streamOfflineId) {
        await deleteSubscription(streamOfflineId, token);
      }

      user.settings.streamSync = false;

      await user.settings.save();

      ctx.responder.respond(`Changed stream sync to ${bool}`);
    } else {
      ctx.responder.respond("Not subscribed to stream");
    }
  }
});

async function subscribeToStream(id: string, room: string, token: string) {
  const responseStreamOnline = await axios.post(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
      type: "stream.online",
      version: "1",
      condition: {
        broadcaster_user_id: id,
      },
      transport: {
        method: "webhook",
        callback: `${process.env.URL}/eventsub`,
        secret: process.env.TWITCH_EVENTS_SECRET,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.TWITCH_CLIENT_ID,
      },
    }
  );

  if (responseStreamOnline.status !== 202) {
    throw new Error("Error while subscribing to stream.online");
  }

  await redisClient.set(`${room}:stream-online`, responseStreamOnline.data.data.id);

  const responseStreamOffline = await axios.post(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
      type: "stream.offline",
      version: "1",
      condition: {
        broadcaster_user_id: id,
      },
      transport: {
        method: "webhook",
        callback: `${process.env.URL}/eventsub`,
        secret: process.env.TWITCH_EVENTS_SECRET,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.TWITCH_CLIENT_ID,
      },
    }
  );

  if (responseStreamOffline.status !== 202) {
    throw new Error("Error while subscribing to stream.offline");
  }

  await redisClient.set(`${room}:stream-offline`, responseStreamOffline.data.data.id);
}

async function deleteSubscription(id: string, token: string) {
  await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-ID": process.env.TWITCH_CLIENT_ID,
    },
  });
}
