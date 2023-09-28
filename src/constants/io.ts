import { httpServer } from "index";
import { Server, ServerOptions } from "socket.io";

const options: Partial<ServerOptions> = {
  cors: {
    origin: ["http://localhost:5713"],
  },
};

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);
