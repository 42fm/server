import axios from "axios";
import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../db/entity/User";
import { client } from "../index";
import { log } from "../utils/loggers";

const router = Router();

const { TWITCH_CLIENT_ID, TWITCH_SECRET, CALLBACK_URL, TWITCH_EVENTS_SECRET } = process.env;

router.get("/twitch", async (req: Request, res: Response) => {
  let code = req.query.code;

  if (!code || typeof code !== "string") {
    log.info("No code was provided", { code });
    return res.sendStatus(400);
  }

  try {
    // Get Access Token (OAuth authorization code flow)
    const request = await axios
      .post<TwitchAppAccessTokenResponse>(
        "https://id.twitch.tv/oauth2/token",
        new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: CALLBACK_URL,
        })
      )
      .catch((e) => {
        if (e.response) {
          console.log(e.response.data);
          console.log(e.response.status);
          console.log(e.response.headers);
        }
        console.log("catch");
      });

    if (!request) {
      console.log("request");
      return;
    }

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

    if (user.channel.isEnabled) {
      await client.join(user.username);
      log.info("Joined channel " + data.login);
    }

    // const token = jwt.sign({ id: user.id }, "test123");

    // console.log(token);

    // res.cookie("access_token", token.toString(), {
    //   // sameSite: "none",
    //   // secure: false,
    //   httpOnly: true,
    // });

    // res.cookie("rememberme", "1", { expires: new Date(Date.now() + 900000), httpOnly: true });

    res.send(`
        <html>
          <body style="witht:100vw;height:100vh;display:flex;align-items:center;justify-content:center">
            Channel added, you can close this window.
          </body>
        </html>
        `);
  } catch (error) {
    console.log(error);
    log.error("Twitch auth error:", error);
    res.sendStatus(500);
  }
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies["access_token"];

    if (!token) {
      return res.sendStatus(401);
    }

    const payload = jwt.verify(token, "test123") as { id: string };

    const user = await User.findOne({ where: { id: Number(payload.id) } });

    return res.json({ id: user.id, username: user.username });
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

// router.get("/channel/bot", auth, async (req, res) => {
//   // @ts-ignore
//   const user = await User.findOne({ where: { id: req.user.id }, select: { channel: { isEnabled: true } } });

//   console.log(user);

//   res.json({ connected: user.channel.isEnabled });
// });

// router.post("/channel/bot", auth, async (req,res) => {

// })

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
