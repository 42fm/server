import { redisClient } from "@db/redis.js";
import axios, { type AxiosResponse } from "axios";
import { logger } from "./loggers.js";

interface TwitchAppAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const { TWITCH_CLIENT_ID, TWITCH_SECRET } = process.env;

async function getNewAppAccessToken() {
  // Get App Access Token (Client credentials grant flow)
  let response: AxiosResponse<TwitchAppAccessTokenResponse> | undefined;

  try {
    response = await axios.post<TwitchAppAccessTokenResponse>(
      "https://id.twitch.tv/oauth2/token",
      new URLSearchParams({
        client_id: TWITCH_CLIENT_ID!,
        client_secret: TWITCH_SECRET!,
        grant_type: "client_credentials",
      })
    );
  } catch {
    logger.error("Could not get twitch token");
  }

  if (!response) {
    logger.error("Could not get twitch token");
    return;
  }

  return response.data;
}

export async function getAppAccessToken() {
  let token: string | null = null;

  try {
    token = await redisClient.get("app_access_token");

    if (!token) {
      const data = await getNewAppAccessToken();
      if (!data) return null;
      await redisClient.setex("app_access_token", data.expires_in - 60, data.access_token);
      token = data.access_token;
      logger.info("Got new app access token");
    } else {
      logger.info("Got cached app access token");
    }
  } catch (err) {
    logger.info("Could not get app access token", { err });
  }

  return token;
}
