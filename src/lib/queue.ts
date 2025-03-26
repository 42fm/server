class QueueNode {
  cb?: () => void;
  next?: QueueNode;

  constructor(cb?: (() => void) | undefined, next?: QueueNode) {
    this.cb = cb;
    this.next = next;
  }
}

export interface QueueI {
  add(cb: () => void): void;
}

export class Queue implements QueueI {
  private limitPerInterval: number;
  private remaining: number;
  private head: QueueNode;
  private tail: QueueNode;

  constructor({ limitPerInterval, reseltLimitMs }: { limitPerInterval: number; reseltLimitMs: number }) {
    this.limitPerInterval = limitPerInterval;
    this.remaining = limitPerInterval;
    this.head = new QueueNode();
    this.tail = this.head;

    setInterval(() => {
      this.remaining = this.limitPerInterval;
      this.run();
    }, reseltLimitMs);
  }

  private run() {
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
