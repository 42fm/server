import winston, { createLogger, format, transports } from "winston";

let logger: winston.Logger;

if (process.env.NODE_ENV === "development") {
  logger = createLogger({
    level: "silly",
    format: format.combine(
      format.align(),
      format.metadata(),
      format.colorize(),
      format.timestamp({
        format: "HH:mm:ss",
      }),
      format.prettyPrint(),
      format.errors({ stack: true }),
      format.splat(),
      format.printf(
        (info) =>
          `${info.timestamp} [${info.level}] ${info.message} ${!isEmpty(info.metadata) ? JSON.stringify(info.metadata) : ""}`
      )
    ),
    transports: [new transports.Console()],
  });
} else {
  logger = createLogger({
    level: "debug",
    format: format.combine(format.prettyPrint(), format.errors({ stack: true }), format.splat(), format.simple()),
    transports: [new transports.Console()],
  });
}

export { logger };

function isEmpty(obj: object) {
  return Object.keys(obj).length === 0;
}
