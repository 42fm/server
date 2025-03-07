import { Queue } from "@lib/queue.js";
import assert from "node:assert";
import { describe, it, mock } from "node:test";

mock.timers.enable({ apis: ["setInterval"] });

describe("queue", () => {
  it("should refresh limit after interval", () => {
    const callback = mock.fn();
    const queue = new Queue({ limit: 3, intervalMs: 1000 });

    queue.add(callback);
    queue.add(callback);
    queue.add(callback);
    queue.add(callback);

    assert.strictEqual(callback.mock.callCount(), 3);
    mock.timers.tick(999);
    assert.strictEqual(callback.mock.callCount(), 3);
    mock.timers.tick(1);
    assert.strictEqual(callback.mock.callCount(), 4);
  });

  it("should call each function after 1s after the first function", () => {
    const callback = mock.fn();
    const queue = new Queue({ limit: 1, intervalMs: 1000 });

    queue.add(callback);
    queue.add(callback);
    queue.add(callback);

    assert.strictEqual(callback.mock.callCount(), 1);
    mock.timers.tick(1000);
    assert.strictEqual(callback.mock.callCount(), 2);
    mock.timers.tick(1000);
    assert.strictEqual(callback.mock.callCount(), 3);
  });
});
