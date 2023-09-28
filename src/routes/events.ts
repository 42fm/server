import { client } from "@constants/tmi";
import { raw, Router } from "express";
import crypto from "node:crypto";
import { io } from "../index";
import { logger } from "../utils/loggers";

const router = Router();

const { TWITCH_CLIENT_ID, TWITCH_EVENTS_SECRET } = process.env;

// Notification request headers
const TWITCH_MESSAGE_ID = "Twitch-Eventsub-Message-Id".toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = "Twitch-Eventsub-Message-Timestamp".toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = "Twitch-Eventsub-Message-Signature".toLowerCase();
const MESSAGE_TYPE = "Twitch-Eventsub-Message-Type".toLowerCase();

// Notification message types
const MESSAGE_TYPE_VERIFICATION = "webhook_callback_verification";
const MESSAGE_TYPE_NOTIFICATION = "notification";
const MESSAGE_TYPE_REVOCATION = "revocation";

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = "sha256=";

router.post("/eventsub", raw({ type: "application/json" }), async (req, res) => {
  let secret = getSecret();
  let message = getHmacMessage(req);
  let hmac = HMAC_PREFIX + getHmac(secret, message); // Signature to compare

  if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
    console.log("signatures match");

    // Get JSON object from body, so you can process the message.
    let notification = JSON.parse(req.body);

    if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
      // TODO: Do something with the event's data.
      if (notification.subscription.type === "stream.online") {
        logger.info(`Pausing ${notification.event.broadcaster_user_login} because they went live`);
        client.say(notification.event.broadcaster_user_login.toLowerCase(), "Pausing because streamer went live PogChamp");
        io.in(notification.event.broadcaster_user_login.toLowerCase()).emit("pause");
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
  // TODO: Get secret from secure storage. This is the secret you pass
  // when you subscribed to the event.
  return TWITCH_EVENTS_SECRET;
}

// Build the message used to get the HMAC.
function getHmacMessage(request: any) {
  return request.headers[TWITCH_MESSAGE_ID] + request.headers[TWITCH_MESSAGE_TIMESTAMP] + request.body;
}

// Get the HMAC.
function getHmac(secret: any, message: any) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

// Verify whether our hash matches the hash that Twitch passed in the header.
function verifyMessage(hmac: any, verifySignature: any) {
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}

export default router;
