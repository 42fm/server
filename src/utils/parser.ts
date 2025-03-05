import { UNICODE_TAG_0 } from "@constants/unicode.js";

export function parseMessage(message: string) {
  return message.replaceAll(UNICODE_TAG_0, "").trim().split(/\s+/);
}
