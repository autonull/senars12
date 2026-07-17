export class Stamp {
    creationTime;
    ids;
    static #counter = 0;
    constructor(ids) {
        this.creationTime = process.hrtime.bigint();
        this.ids = new Set(ids);
    }
    overlaps(other) {
        for (const id of this.ids) {
            if (other.ids.has(id))
                return true;
        }
        return false;
    }
    nextStamp() {
        let newId = ++Stamp.#counter;
        const allIds = new Set(this.ids);
        while (allIds.has(newId))
            newId = ++Stamp.#counter;
        return new Stamp([...this.ids, newId]);
    }
}
//# sourceMappingURL=stamp.js.map