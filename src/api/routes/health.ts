import { Router } from "express";
import { healthHandler } from "../controllers/health.js";

const router = Router();

router.get("/health", healthHandler);

export { router as healthRouter };
