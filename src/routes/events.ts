import { songManager } from "@constants/manager.js";
import { client } from "@constants/tmi.js";
import { type Request, Router, raw } from "express";
import crypto from "node:crypto";
import { logger } from "../utils/loggers.js";

const eventsRouter = Router();

const { TWITCH_EVENTS_SECRET } = process.env;

const TWITCH_MESSAGE_ID = "Twitch-Eventsub-Message-Id".toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = "Twitch-Eventsub-Message-Timestamp".toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = "Twitch-Eventsub-Message-Signature".toLowerCase();
const MESSAGE_TYPE = "Twitch-Eventsub-Message-Type".toLowerCase();

const MESSAGE_TYPE_VERIFICATION = "webhook_callback_verification";
const MESSAGE_TYPE_NOTIFICATION = "notification";
const MESSAGE_TYPE_REVOCATION = "revocation";

const HMAC_PREFIX = "sha256=";

eventsRouter.post("/eventsub", raw({ type: "application/json" }), async (req, res) => {
  const secret = getSecret();
  const message = getHmacMessage(req);
  const hmac = HMAC_PREFIX + getHmac(secret, message); // Signature to compare

  if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE] as string)) {
    console.log("signatures match");

    const notification = JSON.parse(req.body);

    if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
      if (notification.subscription.type === "stream.online") {
        const room = notification.event.broadcaster_user_login.toLowerCase();
        logger.info(`Pausing ${notification.event.broadcaster_user_login} because they went live`);
        try {
          await songManager.pause(room);
          client.say(room, "Pausing because streamer went live PogChamp");
        } catch (err) {
          logger.error(err);
        }
      } else if (notification.subscription.type === "stream.offline") {
        const room = notification.event.broadcaster_user_login.toLowerCase();
        logger.info(`Resuming ${notification.event.broadcaster_user_login} because they went offline`);
        try {
          await songManager.play(room);
          client.say(room, "Resuming because streamer went offline PogChamp");
        } catch (err) {
          logger.error(err);
        }
      }

      console.log(`Event type: ${notification.subscription.type}`);
      console.log(JSON.stringify(notification.event, null, 4));

      res.sendStatus(204);
    } else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
      res.status(200).send(notification.challenge);
    } else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
      res.sendStatus(204);

      console.log(`${notification.subscription.type} notifications revoked!`);
      console.log(`reason: ${notification.subscription.status}`);
      console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
    } else {
      res.sendStatus(204);
      console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
    }
  } else {
    console.log("403"); // Signatures didn't match.
    res.sendStatus(403);
  }
});

function getSecret() {
  return TWITCH_EVENTS_SECRET!;
}

function getHmacMessage(request: Request) {
  return (request.headers[TWITCH_MESSAGE_ID] as string) + request.headers[TWITCH_MESSAGE_TIMESTAMP] + request.body;
}

function getHmac(secret: string, message: string) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function verifyMessage(hmac: string, verifySignature: string) {
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}

export default eventsRouter;
