import { ChatUserstate, Client } from "tmi.js";
import { Queue } from "./queue";

export class Responder {
  client: Client;
  tags: ChatUserstate;
  room: string;
  queue: Queue;

  constructor(client: Client, tags: ChatUserstate, room: string, queue: Queue) {
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
