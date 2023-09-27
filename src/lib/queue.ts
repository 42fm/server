class QueueNode {
  cb: (...args: any) => any;
  next: QueueNode;

  constructor(cb?: (...args: any) => any, next?: QueueNode) {
    this.cb = cb;
    this.next = next;
  }
}

export class Queue {
  limit: number;
  remaining: number;
  head: QueueNode;
  tail: QueueNode;

  constructor(messagesPerThirtySecconds: number = 3) {
    this.limit = messagesPerThirtySecconds;
    this.remaining = messagesPerThirtySecconds;
    this.head = new QueueNode();
    this.tail = this.head;

    setInterval(() => {
      this.remaining = this.limit;
      this.run();
    }, 30_000);
  }

  run() {
    let dummy = this.head;

    while (dummy.next && this.remaining > 0) {
      dummy.next.cb();
      dummy = dummy.next;
      this.remaining -= 1;
    }

    this.head = dummy;
  }

  add(cb: (...args: any) => any) {
    if (this.remaining > 0) {
      cb();
      this.remaining -= 1;
    } else {
      this.tail.next = new QueueNode(cb);
      this.tail = this.tail.next;
    }
  }
}
