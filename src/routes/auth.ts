import axios, { AxiosResponse } from "axios";
import { Request, Response, Router } from "express";
import { client } from "../constants/tmi";
import { User } from "../db/entity/User";
import { logger } from "../utils/loggers";

const router = Router();

const { TWITCH_CLIENT_ID, TWITCH_SECRET, URL } = process.env;

router.get("/twitch", async (req: Request, res: Response) => {
  const code = req.query.code;

  if (!code || typeof code !== "string") {
    logger.info("No code was provided", { code });
    return res.sendStatus(400);
  }

  // https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=as9g1b0p5gcioxg2u02imxsh2xknzr&redirect_uri=https://api.42fm.app/twitch&scope=user:read:email
  // Get Access Token (OAuth authorization code flow)
  let request: AxiosResponse<TwitchAppAccessTokenResponse> = null;
  try {
    request = await axios.post<TwitchAppAccessTokenResponse>(
      "https://id.twitch.tv/oauth2/token",
      new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: URL + "/twitch",
      })
    );
  } catch {
    return res.sendStatus(500);
  }

  // Get User Info
  let response: AxiosResponse<{ data: TwitchAuthResponse[] }>;
  try {
    response = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${request.data.access_token}`,
        "Client-Id": TWITCH_CLIENT_ID!,
      },
    });
  } catch {
    return res.sendStatus(500);
  }

  const data: TwitchAuthResponse = response.data.data[0];

  let user: User | null;
  user = await User.findOne({ where: { twitch_id: data.id } });

  if (!user) {
    const newUser = User.create({
      twitch_id: data.id,
      username: data.login,
      display_name: data.display_name,
      email: data.email,
    });
    user = await newUser.save();
  }

  if (user.channel.isEnabled) {
    try {
      const channel = await client.join(user.username);
      logger.info("Joined channel " + channel[0]);
    } catch (error) {
      logger.error("Unable to join channel", {
        username: user.username,
        error,
      });
      return res.send(`
      <html>
        <body style="witht:100vw;height:100vh;display:flex;align-items:center;justify-content:center">
          Channel added, but the bot did not join the channel yet.
        </body>
      </html>
      `);
    }
  }

  res.send(`
        <html>
          <body style="witht:100vw;height:100vh;display:flex;align-items:center;justify-content:center">
            Channel added, you can close this window.
          </body>
        </html>
        `);
});

router.get("/twitch/mobile", async (req: Request, res: Response) => {
  console.log(req.query);
  console.log(req.params);

  res.redirect("fm://twitch/mobile");
});

export default router;

export interface TwitchAuthResponse {
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
  created_at: Date;
}

interface TwitchAppAccessTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}
