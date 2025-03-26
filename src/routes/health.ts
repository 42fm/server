import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res.sendStatus(200);
});

export { router as healthRouter };
