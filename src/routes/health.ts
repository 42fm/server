import { Router } from "express";
import morganMiddleware from "../middleware/morganMiddleware";

const router = Router();

router.use(morganMiddleware);

router.get("/health", async (req, res) => {
  res.sendStatus(200);
});

export default router;
