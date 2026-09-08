export class Stamp {
    static #counter = 0;
    readonly creationTime: bigint;
    readonly ids: ReadonlySet<number>;

    constructor(ids: Iterable<number>) {
        this.creationTime = process.hrtime.bigint();
        this.ids = new Set(ids);
    }

    overlaps(other: Stamp): boolean {
        for (const id of this.ids) {
            if (other.ids.has(id)) return true;
        }
        return false;
    }

    nextStamp(): Stamp {
        let newId = ++Stamp.#counter;
        const allIds = new Set(this.ids);
        while (allIds.has(newId)) newId = ++Stamp.#counter;
        return new Stamp([...this.ids, newId]);
    }
}
