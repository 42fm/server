import axios from "axios";
import { getAppAccessToken } from "./appAccessToken.js";

const { TWITCH_CLIENT_ID } = process.env;

export class GetUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GetUserError";
  }
}

export async function getTwitchUser(username: string | undefined) {
  if (!username) {
    throw new GetUserError("Username is required");
  }

  const token = await getAppAccessToken();

  if (!token) {
    throw new GetUserError("Could not get app access token");
  }

  const response = await axios.get<HelixUsersResponse>(
    "https://api.twitch.tv/helix/users?" + new URLSearchParams([["login", username]]).toString(),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": TWITCH_CLIENT_ID,
      },
    }
  );

  if (response.data.data.length === 0) {
    throw new GetUserError("User not found");
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
