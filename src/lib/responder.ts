import type { Actions, ChatUserstate } from "tmi.js";
import type { QueueI } from "./queue.js";

type Say = Actions["say"];

export interface ClientI {
  say: Say;
}

export class Responder {
  client: ClientI;
  tags: ChatUserstate;
  room: string;
  queue: QueueI;

  constructor(client: ClientI, tags: ChatUserstate, room: string, queue: QueueI) {
    this.client = client;
    this.tags = tags;
    this.room = room;
    this.queue = queue;
  }

  respondWithMention(message: string) {
    this.queue.add(() => this.client.say(this.room, `@${this.tags["display-name"]}, ${message}`));
  }

  respond(message: string) {
    this.queue.add(() => this.client.say(this.room, message));
  }
}
