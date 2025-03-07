import { parseMessage } from "@utils/parser.js";
import assert from "assert";
import { describe, test } from "node:test";

describe("parseMessage", () => {
  test("parses simple message", () => {
    assert.deepStrictEqual(parseMessage("one two three"), ["one", "two", "three"]);
  });
  test("with three spaces between", () => {
    assert.deepStrictEqual(parseMessage("one   two    three"), ["one", "two", "three"]);
  });
  test("with three spaces as prefix", () => {
    assert.deepStrictEqual(parseMessage("   one two"), ["one", "two"]);
  });
  test("with three spaces as suffix", () => {
    assert.deepStrictEqual(parseMessage("one two   "), ["one", "two"]);
  });
});

// https://github.com/SevenTV/Extension/blob/16e1e4bcaa4b59e06e1ee92a61b0da986463bfb0/src/common/Constant.ts#L20
describe("parseMessage with invisible characters (codepoint U+E0000)", () => {
  test("parses with one space and a invisible character", () => {
    assert.deepStrictEqual(parseMessage("one two 󠀀"), ["one", "two"]);
  });
  test("parses with a invisible character", () => {
    assert.deepStrictEqual(parseMessage("one two󠀀"), ["one", "two"]);
  });
});
