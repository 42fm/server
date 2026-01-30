import { Router } from "express";
import { twitchHandler, twitchMobileHandler } from "../controllers/auth.js";

const router = Router();

router.get("/twitch", twitchHandler);
router.get("/twitch/mobile", twitchMobileHandler);

export { router as authRouter };
