import { eventsubHandler } from "@api/controllers/evetsub.js";
import { Router, raw } from "express";

const router = Router();

router.post("/eventsub", raw({ type: "application/json" }), eventsubHandler);

export { router as eventsRouter };
