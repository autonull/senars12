import { type IPCMessage, deserialize, serialize } from './protocol.js';

export class SharedMemoryQueue {
  private readonly buffer: SharedArrayBuffer;
  private readonly head: Int32Array;
  private readonly tail: Int32Array;
  private readonly data: Uint8Array;

  constructor(size: number = 1024 * 1024) {
    this.buffer = new SharedArrayBuffer(size + 8);
    this.head = new Int32Array(this.buffer, 0, 1);
    this.tail = new Int32Array(this.buffer, 4, 1);
    this.data = new Uint8Array(this.buffer, 8);
  }

  push(msg: IPCMessage): void {
    const bytes = serialize(msg);
    const tail = Atomics.load(this.tail, 0);
    const nextTail = (tail + bytes.length + 4) % this.data.length;

    const view = new DataView(this.buffer);
    view.setUint32(8 + tail, bytes.length, true);
    this.data.set(bytes, tail + 4);

    Atomics.store(this.tail, 0, nextTail);
    Atomics.notify(this.tail, 0);
  }

  pop(): IPCMessage | null {
    const head = Atomics.load(this.head, 0);
    const tail = Atomics.load(this.tail, 0);

    if (head === tail) return null;

    const length = new DataView(this.buffer).getUint32(8 + head, true);
    const bytes = this.data.slice(head + 4, head + 4 + length);

    Atomics.store(this.head, 0, (head + length + 4) % this.data.length);
    return deserialize(bytes);
  }
}
