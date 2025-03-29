import { User } from "@db/entity/User.js";
import { redisClient } from "@db/redis.js";
import { logger } from "@utils/loggers.js";
import { Server as HttpServer } from "node:http";
import { Server, type ServerOptions, Socket } from "socket.io";
import { Logger } from "winston";

const { URL } = process.env;

export interface SocketData {
  logger: Logger;
}

export type SocketType = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ServerType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function createSocketServer(httpServer: HttpServer) {
  const options: Partial<ServerOptions> = {
    cors: {
      origin: [URL!],
    },
  };

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);

  io.on("connection", (socket) => {
    socket.data.logger = logger.child({
      service: "ws",
      socketId: socket.id,
      ip: (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0],
    });

    const childLogger = socket.data.logger;

    childLogger.info("New socket connection");

    socket.on("error", (err) => {
      childLogger.info("socket error", err);
    });
    socket.on("joinRoom", joinRoomHandler(io, socket));
    socket.on("sync", syncHandler(io, socket));
    socket.on("disconnecting", disconnectingHandler(io, socket));
  });

  return io;
}

function disconnectingHandler(io: ServerType, socket: SocketType) {
  return async () => {
    const { logger } = socket.data;
    const rooms = new Set(socket.rooms);
    for (const room of Array.from(rooms).slice(1)) {
      const sockets = await io.in(room).fetchSockets();
      io.in(room).emit("userCount", sockets.length - 1);
      logger.info("disconnecting", { room, socketsCount: sockets.length });
    }
  };
}

function syncHandler(io: ServerType, socket: SocketType): ({ room }: { room: string }) => void {
  return (data) => {
    const { logger } = socket.data;

    const room = data.room.toLowerCase();

    logger.info("Sync event", { room });

    redisClient
      .ttl(`${room}:current`)
      .then((ttl) => {
        if (ttl > 0) {
          logger.debug(ttl);
          socket.emit("songSync", ttl);
        }
      })
      .catch((err) => logger.error(err));
  };
}

function joinRoomHandler(io: ServerType, socket: SocketType): ({ room }: { room: string }) => void {
  return async (data) => {
    const { logger } = socket.data;

    const room = data.room.toLowerCase();

    const user = await User.findOne({ where: { username: room, channel: { isEnabled: true } } });

    if (!user) {
      logger.info("Not enabled on channel", { room });
      socket.emit("no42fm");
      socket.disconnect();
      return;
    }

    logger.info("Joined room", { room });
    await socket.join(room);

    const sockets = await io.in(room).fetchSockets();

    io.in(room).emit("userCount", sockets.length);

    redisClient
      .multi()
      .get(`${room}:current`)
      .lrange(`${room}:playlist`, 0, -1)
      .ttl(`${room}:current`)
      .exec((err, replies) => {
        const [, current] = replies![0] as [Error, string];
        const [, playlist] = replies![1] as [Error, string[]];
        const [, ttl] = replies![2] as [Error, number];

        let isPlaying;

        if (ttl >= 0) {
          isPlaying = true;
        } else {
          isPlaying = false;
        }

        const currentWithTTL: CurrentSong = {
          ...JSON.parse(current),
          durationRemaining: ttl,
          isPlaying,
        };

        logger.debug(`${JSON.stringify(currentWithTTL)}`);

        if (current && playlist) {
          const list = playlist.map((item: string) => JSON.parse(item));
          socket.emit("song", { current: currentWithTTL, list });
        }
      });
  };
}
