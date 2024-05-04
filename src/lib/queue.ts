class QueueNode {
  cb?: () => void;
  next?: QueueNode;

  constructor(cb?: (() => void) | undefined, next?: QueueNode) {
    this.cb = cb;
    this.next = next;
  }
}

export class Queue {
  limit: number;
  remaining: number;
  head: QueueNode;
  tail: QueueNode;

  constructor({ limit, intervalMs }: { limit: number; intervalMs: number }) {
    this.limit = limit;
    this.remaining = limit;
    this.head = new QueueNode();
    this.tail = this.head;

    setInterval(() => {
      this.remaining = this.limit;
      this.run();
    }, intervalMs);
  }

  run() {
    let dummy = this.head;

    while (dummy.next && this.remaining > 0) {
      if (dummy.next.cb) {
        dummy.next.cb();
      }
      dummy = dummy.next;
      this.remaining -= 1;
    }

    this.head = dummy;
  }

  add(cb: () => void) {
    if (this.remaining > 0) {
      cb();
      this.remaining -= 1;
    } else {
      this.tail.next = new QueueNode(cb);
      this.tail = this.tail.next;
    }
  }
}
