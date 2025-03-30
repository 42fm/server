import { Router } from "@lib/router.js";
import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

const callback = mock.fn();
const middleware = mock.fn((_, __, next) => next());

describe("router", () => {
  beforeEach(() => {
    callback.mock.resetCalls();
    middleware.mock.resetCalls();
  });

  it("should route", async () => {
    const router = new Router<null>();
    router.register("!ping", callback);

    await router.route(null, ["!ping"]);
    assert.strictEqual(callback.mock.callCount(), 1);
  });

  it("should not route", async () => {
    const router = new Router<null>();
    router.register("!ping", callback);

    await router.route(null, ["!help"]);
    assert.strictEqual(callback.mock.callCount(), 0);
  });

  it("should work with middleware", async () => {
    const router = new Router<null>();
    router.register("!ping", middleware, middleware, callback);

    await router.route(null, ["!ping"], 0);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(middleware.mock.callCount(), 2);
  });

  it("should call all async middleware and callback", async () => {
    const middlewareAsync = mock.fn(async (_, __, next) => {
      next();
    });

    const router = new Router<null>();
    router.register("!ping", middlewareAsync, middlewareAsync, callback);

    await router.route(null, ["!ping"], 0);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(middlewareAsync.mock.callCount(), 2);
  });

  it("should stop at first async middleware", async () => {
    const middlewareAsync = mock.fn(async () => {});

    const router = new Router<null>();
    router.register("!ping", middlewareAsync, middlewareAsync, callback);

    await router.route(null, ["!ping"], 0);
    assert.strictEqual(callback.mock.callCount(), 0);
    assert.strictEqual(middlewareAsync.mock.callCount(), 1);
  });

  it("should route through another router", async () => {
    const nextFn = mock.fn();

    const nextRouter = new Router<null>();
    nextRouter.register("world", nextFn);

    const router = new Router<null>();
    router.register("hello", callback);
    router.registerNextRouter("hello", nextRouter);

    await router.route(null, ["hello", "world"]);
    assert.strictEqual(callback.mock.callCount(), 0);
    assert.strictEqual(nextFn.mock.callCount(), 1);
  });

  it("should route through another router with middleware", async () => {
    const nonCallback = mock.fn();

    const nextRouter = new Router<null>();
    nextRouter.register("song", middleware, callback);

    const router = new Router<null>();
    router.register("!help", middleware, nonCallback);
    router.registerNextRouter("!help", nextRouter);

    await router.route(null, ["!help", "song"]);
    assert.strictEqual(nonCallback.mock.callCount(), 0);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(middleware.mock.callCount(), 2);
  });

  it("should throw if route not registered when trying to register next router", () => {
    const router = new Router<null>();
    const nextRouter = new Router<null>();

    assert.throws(() => router.registerNextRouter("!help", nextRouter), new Error("Router not found: !help"));
  });
});
