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
            let minP = Infinity;
            for (const {priority: p} of this.items) if (p < minP) minP = p;
            if (priority <= minP) return false;
            const minIdx = this.items.findIndex(i => i.priority === minP);
            this.items.splice(minIdx, 1);
        }
        const idx = this.items.findIndex(i => i.priority < priority);
        idx === -1
            ? this.items.push({item, priority, addedAt: Date.now()})
            : this.items.splice(idx, 0, {item, priority, addedAt: Date.now()});
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
