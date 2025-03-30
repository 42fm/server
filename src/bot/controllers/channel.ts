import { Settings } from "@db/entity/Settings.js";
import { User } from "@db/entity/User.js";
import connection from "@db/index.js";
import type { Context } from "@lib/router.js";
import { getUser } from "@root/services/user.js";
import { getTwitchUser } from "@root/utils/getUser.js";
import { logger } from "@root/utils/loggers.js";

export async function handleAdd(ctx: Context, args: string[]) {
  const username = args[0];

  const twitch_user = await getTwitchUser(username);

  if (!twitch_user) {
    ctx.responder.respondWithMention("user not found");
    return;
  }

  const runner = connection.createQueryRunner();

  await runner.connect();

  await runner.startTransaction();

  const settings = new Settings();
  const user = new User();
  user.twitch_id = twitch_user.id;
  user.username = twitch_user.login;
  user.display_name = twitch_user.display_name;
  user.email = "temp@gmail.com";
  user.settings = settings;

  try {
    await runner.manager.save(settings);
    await runner.manager.save(user);

    await runner.commitTransaction();
    ctx.responder.respondWithMention("channel added");
  } catch (error) {
    logger.error(error);
    await runner.rollbackTransaction();
    ctx.responder.respondWithMention("failed to add to channel");
  } finally {
    await runner.release();
  }
}

export async function handleEnable(ctx: Context, args: string[]) {
  const username = args[0];

  const twitch_user = await getTwitchUser(username);

  if (!twitch_user) {
    ctx.responder.respondWithMention("user not found");
    return;
  }

  const user = await getUser(twitch_user.login);

  if (!user) {
    ctx.responder.respondWithMention("user not found");
    return;
  }

  if (user.channel.isEnabled) {
    ctx.responder.respondWithMention("channel already enabled");
    return;
  }

  user.channel.isEnabled = true;

  try {
    await user.save();
    ctx.responder.respondWithMention("channel disabled successfully");
  } catch (error) {
    logger.error(error);
    ctx.responder.respondWithMention("failed to disable channel");
  }
}
export async function handleDisable(ctx: Context, args: string[]) {
  const username = args[0];

  const twitch_user = await getTwitchUser(username);

  if (!twitch_user) {
    ctx.responder.respondWithMention("user not found");
    return;
  }

  const user = await getUser(twitch_user.login);

  if (!user) {
    ctx.responder.respondWithMention("user not found");
    return;
  }

  if (!user.channel.isEnabled) {
    ctx.responder.respondWithMention("channel already disabled");
    return;
  }

  user.channel.isEnabled = false;

  try {
    await user.save();
    ctx.responder.respondWithMention("channel disabled successfully");
  } catch (error) {
    logger.error(error);
    ctx.responder.respondWithMention("failed to disable channel");
  }
}
