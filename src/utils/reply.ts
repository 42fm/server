import { ChatUserstate, Client } from "tmi.js";

export class Responder {
  client: Client;
  tags: ChatUserstate;
  room: string;

  constructor(client: Client, tags: ChatUserstate, room: string) {
    this.client = client;
    this.tags = tags;
    this.room = room;
  }

  respondWithMention(message: string) {
    this.client.say(this.room, `@${this.tags["display-name"]}, ${message}`);
  }

  respond(message: string) {
    this.client.say(this.room, message);
  }
}
