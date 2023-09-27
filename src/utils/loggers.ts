import { TransformableInfo } from "logform";
import winston, { createLogger, format, transports } from "winston";

let logger: winston.Logger;

if (process.env.NODE_ENV === "development") {
  logger = createLogger({
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
} else {
  logger = createLogger({
    level: "debug",
    format: format.combine(format.prettyPrint(), format.errors({ stack: true }), format.splat(), format.simple()),
    transports: [new transports.Console()],
  });
  // log = createLogger({
  //   level: "warn",
  //   format: format.combine(format.json(), format.errors({ stack: true }), format.splat()),
  //   transports: [new transports.Console()],
  // });
}

export { logger };

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
