import type {IOMessage} from '../io/types.js';

export class MessageQueue {
    private messages: IOMessage[] = [];
    private waiting: Array<(msg: IOMessage) => void> = [];

    push(message: IOMessage): void {
        this.messages.push(message);
        const waiter = this.waiting.shift();
        if (waiter) {
            waiter(message);
        }
    }

    async pop(timeoutMs = 1000): Promise<IOMessage | null> {
        if (this.messages.length > 0) {
            return this.messages.shift()!;
        }

        return new Promise<IOMessage | null>((resolve) => {
            const timeout = setTimeout(() => {
                const idx = this.waiting.indexOf(resolve);
                if (idx !== -1) this.waiting.splice(idx, 1);
                resolve(null);
            }, timeoutMs);

            this.waiting.push((msg) => {
                clearTimeout(timeout);
                resolve(msg);
            });
        });
    }

    drain(): IOMessage[] {
        const batch = [...this.messages];
        this.messages = [];
        return batch;
    }

    size(): number {
        return this.messages.length;
    }

    clear(): void {
        this.messages = [];
        this.waiting = [];
    }
}
