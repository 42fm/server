import type { Request, Response } from "express";

export function healthHandler(req: Request, res: Response) {
  res.sendStatus(200);
}
