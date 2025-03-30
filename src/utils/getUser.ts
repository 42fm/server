import axios, { type AxiosResponse } from "axios";
import { getAppAccessToken } from "./appAccessToken.js";
import { logger } from "./loggers.js";

const { TWITCH_CLIENT_ID } = process.env;

export class GetUserError extends Error {
  name = "GetUserError";
}

export async function getTwitchUser(username: string) {
  const token = await getAppAccessToken();

  if (!token) {
    return;
  }

  let response: AxiosResponse<HelixUsersResponse> | undefined;

  try {
    response = await axios.get<HelixUsersResponse>(
      "https://api.twitch.tv/helix/users?" + new URLSearchParams([["login", username]]).toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-ID": TWITCH_CLIENT_ID,
        },
      }
    );
  } catch {
    logger.error("Could not get twitch token");
    return;
  }

  if (response.data.data.length === 0) {
    return;
  }

  return response.data.data[0];
}

export interface HelixUsersResponse {
  data: HelixUser[];
}

export interface HelixUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  email: string;
  created_at: string;
}
