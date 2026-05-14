import {AbstractBag, type BagItem} from './bag-base.js';

export {BagItem};

export class Bag<T> extends AbstractBag<T> {
    private readonly maxSize: number;

    constructor(maxSize: number) {
        super();
        this.maxSize = maxSize;
    }

    add(item: T, priority: number): boolean {
        if (this.items.length >= this.maxSize) {
            const minIdx = this.items.length - 1;
            const minP = this.items[minIdx]?.priority ?? Infinity;
            if (priority <= minP) return false;
            this.items.splice(minIdx, 1);
        }
        const idx = this.items.findIndex(i => i.priority < priority);
        this.items.splice(idx === -1 ? this.items.length : idx, 0, {item, priority, addedAt: Date.now()});
        return true;
    }

    pruneTo(maxSize: number): void {
        this.items = this.items.slice(0, maxSize);
    }

    * entries(): Generator<[T, number]> {
        for (const {item, priority} of this.items) {
            yield [item, priority];
        }
    }

    getItems(): T[] {
        return this.items.map(i => i.item);
    }

    override toArray(): T[] {
        return this.items.map(i => i.item);
    }
}
