import assert from "assert";
import redisMock from "ioredis-mock";
import test, { describe } from "node:test";

describe("limiter", () => {
  test("should limit", async (ctx) => {
    ctx.mock.timers.enable({ apis: ["Date"], now: 0 });
    ctx.mock.module("ioredis", {
      namedExports: {
        Redis: redisMock.default,
      },
    });

    const RateLimiter = await import("@lib/limiter.js").then((module) => module.default);

    const ratelimiter = new RateLimiter({
      max: 2,
      time: 3, // seconds
    });

    assert.strictEqual(await ratelimiter.consume("test"), false);
    assert.strictEqual(await ratelimiter.consume("test"), false);
    assert.strictEqual(await ratelimiter.consume("test"), true);

    assert.strictEqual(await ratelimiter.consume("test"), true);
    ctx.mock.timers.setTime(3000);
    assert.strictEqual(await ratelimiter.consume("test"), false);
    assert.strictEqual(await ratelimiter.consume("test"), false);
    assert.strictEqual(await ratelimiter.consume("test"), true);
  });
});
