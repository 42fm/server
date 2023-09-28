import express from "express";
import { createServer } from "http";
import { Server, ServerOptions } from "socket.io";

export const app = express();

export const httpServer = createServer(app);

const options: Partial<ServerOptions> = {
  cors: {
    origin: ["http://localhost:5713"],
  },
};

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options);
