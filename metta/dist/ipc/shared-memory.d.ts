import { type IPCMessage } from './protocol.js';
export declare class SharedMemoryQueue {
    private readonly buffer;
    private readonly head;
    private readonly tail;
    private readonly data;
    constructor(size?: number);
    push(msg: IPCMessage): void;
    pop(): IPCMessage | null;
}
//# sourceMappingURL=shared-memory.d.ts.map