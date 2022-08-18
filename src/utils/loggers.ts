import { TransformableInfo } from "logform";
import { createLogger, format, transports } from "winston";

export const log = createLogger({
  level: "silly",
  format: format.combine(
    format.colorize(),
    format.timestamp({
      format: "HH:mm:ss",
    }),
    format.prettyPrint(),
    format.errors({ stack: true }),
    format.splat(),
    format.printf((info) => `[${info.timestamp}][${info.level}]: ${info.message} ${rest(info)}`)
  ),
  transports: [new transports.Console()],
});

function rest(info: TransformableInfo) {
  return JSON.stringify(
    Object.assign({}, info, {
      level: undefined,
      message: undefined,
      splat: undefined,
      label: undefined,
      timestamp: undefined,
    })
  );
}
