import axios, { AxiosResponse } from "axios";
import { Request, Response, Router } from "express";
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

  // https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=as9g1b0p5gcioxg2u02imxsh2xknzr&redirect_uri=https://api.42fm.app/twitch&scope=user:read:email
  // Get Access Token (OAuth authorization code flow)
  let request: AxiosResponse<TwitchAppAccessTokenResponse, any> = null;
  try {
    request = await axios.post<TwitchAppAccessTokenResponse>(
      "https://id.twitch.tv/oauth2/token",
      new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: CALLBACK_URL,
      })
    );
  } catch {
    return res.sendStatus(500);
  }

  // if (request) {
  //   res.send(500);
  // }

  // Get User Info
  let response: AxiosResponse<{ data: TwitchAuthResponse[] }, any>;
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
    let newUser = User.create({
      twitch_id: data.id,
      username: data.login,
      display_name: data.display_name,
      email: data.email,
    });
    user = await newUser.save();
  }

  if (user.channel.isEnabled) {
    try {
      let channel = await client.join(user.username);
      log.info("Joined channel " + channel[0]);
    } catch (error) {
      log.error("Unable to join channel", {
        username: user.username,
        error,
      });
      res.send(`
      <html>
        <body style="witht:100vw;height:100vh;display:flex;align-items:center;justify-content:center">
          Channel added, but the bot did not join the channel yet.
        </body>
      </html>
      `);
    }
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
});

// router.get("/me", async (req, res) => {
//   try {
//     const token = req.cookies["access_token"];

//     if (!token) {
//       return res.sendStatus(401);
//     }

//     const payload = jwt.verify(token, "test123") as { id: string };

//     const user = await User.findOne({ where: { id: Number(payload.id) } });

//     if (!user) {
//       res.json({ message: "User not found" });
//       return;
//     }

//     return res.json({ id: user.id, username: user.username });
//   } catch (err) {
//     console.log(err);
//     res.sendStatus(500);
//   }
// });

router.get("/twitch/mobile", async (req: Request, res: Response) => {
  console.log(req.query);
  console.log(req.params);

  res.redirect("fm://twitch/mobile");
});

// router.get("/twitch/user/:id", async (req: Request, res: Response) => {
//   // get id
//   const id = req.params.id;

//   if (!id || typeof id !== "string") {
//     return res.json({ message: "Invalid id" });
//   }

//   // Get User Info
//   let response:AxiosResponse<{data: TwitchAuthResponse[]}, any>

//   try {
//     response = await axios.get("https://api.twitch.tv/helix/users", {
//      headers: {
//        Authorization: `Bearer ${request.data.access_token}`,
//        "Client-Id": TWITCH_CLIENT_ID!,
//      },
//    });
//   }  catch {
//     return res.sendStatus(500)
//   }

//   const data: TwitchAuthResponse = response.data.data[0];
// });

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

// error: Twitch auth error: {"0":"N","1":"o","10":"e","11":" ","12":"f","13":"r","14":"o","15":"m","16":" ","17":"T","18":"w","19":"i","2":" ","20":"t","21":"c","22":"h","23":".","3":"r","4":"e","5":"s","6":"p","7":"o","8":"n","9":"s"}
// Noe from Twitch. response
