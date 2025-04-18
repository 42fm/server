import { createLogger, format, transports } from "winston";

const { combine, align, metadata, colorize, timestamp, prettyPrint, errors, splat, printf, simple } = format;

const devFormat = combine(
  align(),
  metadata(),
  colorize(),
  timestamp({
    format: "HH:mm:ss",
  }),
  prettyPrint(),
  errors({ stack: true }),
  splat(),
  printf(
    (info) =>
      `${info.timestamp} [${info.level}] ${info.message} ${!isEmpty(info.metadata) ? JSON.stringify(info.metadata) : ""}`
  )
);

function isEmpty(obj: object | unknown) {
  if (typeof obj !== "object" || obj == null) return true;
  return Object.keys(obj).length === 0;
}

const prodFormat = combine(errors({ stack: true }), timestamp(), simple());

const { LOG_LEVEL, NODE_ENV } = process.env;

const logger = createLogger({
  level: LOG_LEVEL ?? "info",
  format: NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new transports.Console()],
});

export { logger };
