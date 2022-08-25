import axios from "axios";
import { Router } from "express";
import { User } from "../db/entity/User";
import { client } from "../index";
import morganMiddleware from "../middleware/morganMiddleware";
import { log } from "../utils/loggers";

const router = Router();

const { TWITCH_CLIENT_ID, TWITCH_SECRET, CALLBACK_URL, TWITCH_EVENTS_SECRET } = process.env;

router.use(morganMiddleware);

router.get("/twitch", async (req, res) => {
  let code = req.query.code;

  if (!code) return res.sendStatus(400);

  try {
    // Get Access Token (OAuth authorization code flow)
    const request = await axios.post(
      `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_SECRET}&code=${code}&grant_type=authorization_code&redirect_uri=${CALLBACK_URL}`
    );

    // Get User Info
    const response = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${request.data.access_token}`,
        "Client-Id": TWITCH_CLIENT_ID!,
      },
    });

    const data: TwitchAuthResponse = response.data.data[0];

    let user: User;
    user = await User.findOne({ where: { twitch_id: data.id } });

    if (!user) {
      let newUser = User.create({
        twitch_id: data.id,
        username: data.login,
        display_name: data.display_name,
        email: data.email,
      });
      user = await newUser.save();
    }

    await client.join(user.username);
    log.info("Joined channel " + data.login);

    res.send(`
        <div>
          <div>42fm was added to your channel, you can close this window</div>
        </div>
        `);
  } catch (error) {
    log.error(error);
    res.sendStatus(500);
  }
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
