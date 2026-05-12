export interface BagItem<T> {
    readonly item: T;
    readonly priority: number;
    readonly addedAt: number;
}

export abstract class AbstractBag<T> {
    protected items: BagItem<T>[] = [];

    get size(): number {
        return this.items.length;
    }

    abstract add(item: T, priority: number): boolean;

    peek(): T | undefined {
        return this.items[0]?.item;
    }

    remove(item: T): boolean {
        const idx = this.items.findIndex(i => i.item === item);
        if (idx >= 0) {
            this.items.splice(idx, 1);
            return true;
        }
        return false;
    }

    toArray(): T[] {
        return this.items.map(i => i.item);
    }
}
