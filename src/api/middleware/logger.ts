import type { Request, Response, NextFunction } from "express";
import { logger } from "@root/utils/loggers.js";

export function winstonMiddleware(req: Request, _: Response, next: NextFunction) {
  logger.http(`${req.method} ${req.path}`, {
    body: req.body,
    ip: req.ip,
    queryParams: req.query,
  });

  next();
}
