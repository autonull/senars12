const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');
code = code.replace(/this\._totalPriority \+= priority;\n/g, "");
code = code.replace(/this\._totalPriority -= entry\.priority;\n/g, "");
code = code.replace(/const e = this\.heap\[idx\];\n\s*if \(e\) this\._totalPriority -= e\.priority;\n/g, "");
code = code.replace(/this\._totalPriority = 0;\n/g, "");

// Add total priority tracker properly.
const sampleFnReplace = `
const SAMPLE_FN: Record<string, (heap: BagItem<unknown>[], obj: Record<string, unknown>, bag?: any) => unknown> = {
    priority: (h, o, bag) => {
        if (h.length === 0) return undefined;
        let total = bag?._totalPriority;
        if (total === undefined || total <= 0) {
            total = 0;
            for (let i = 0; i < h.length; i++) {
                total += h[i].priority;
            }
            if (bag) bag._totalPriority = total;
        }
        if (total <= 0) return h[h.length - 1]?.item;

        let r = Math.random() * total;
        // iterate backwards (highest priority first for faster exit usually)
        for (let i = h.length - 1; i >= 0; i--) {
            const e = h[i];
            if (e) {
                r -= e.priority;
                if (r <= 0) return e.item;
            }
        }
        return h[0]?.item;
    },
    recency: (h, o) => {
        const cutoff = Date.now() - (o.windowMs as number);
        let best = undefined;
        let bestLastAccess = -1;
        for (let i = 0; i < h.length; i++) {
            const e = h[i];
            if (e && e.lastAccess >= cutoff && e.lastAccess > bestLastAccess) {
                best = e.item;
                bestLastAccess = e.lastAccess;
            }
        }
        return best;
    },
    novelty: h => h[0]?.item,
    composite: (h, o) => {
        const w = o.weights as { priority: number; recency: number };
        const scored = h.map(e => ({
            item: e.item,
            score: e.priority * w.priority - ((Date.now() - e.lastAccess) / 1000) * w.recency
        }));
        return scored.length > 0 ? [...scored].sort((a, b) => b.score - a.score)[0]?.item : undefined;
    }
};
`;

code = code.replace(/const SAMPLE_FN[\s\S]*?\n\};\n/m, sampleFnReplace.trim() + '\n\n');

// Add _totalPriority tracking
if (!code.includes('_totalPriority = 0;')) {
    code = code.replace('private heap: BagItem<T>[] = [];', 'private heap: BagItem<T>[] = [];\n    public _totalPriority = 0;');
}

// Update add
code = code.replace(/idx === -1 \? this\.heap\.push\(entry\) : this\.heap\.splice\(idx, 0, entry\);\n\s*return true;/m,
`idx === -1 ? this.heap.push(entry) : this.heap.splice(idx, 0, entry);
        this._totalPriority += priority;
        return true;`);

// Update removeMany
code = code.replace(/removed\+\+;\n\s*this\.trackRemoval\(\);\n\s*return false;/m,
`removed++;
                this.trackRemoval();
                this._totalPriority -= entry.priority;
                return false;`);

// Update remove
code = code.replace(/const idx = this\.heap\.findIndex\(h => h\.item === item\);\n\s*if \(idx >= 0\) \{\n\s*this\.heap\.splice\(idx, 1\);\n\s*this\.trackRemoval\(\);\n\s*return true;/m,
`const idx = this.heap.findIndex(h => h.item === item);
        if (idx >= 0) {
            const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            this.trackRemoval();
            return true;`);

// Update removeById
code = code.replace(/const idx = this\.heap\.findIndex\(h => this\.getItemId\(h\) === id\);\n\s*if \(idx >= 0\) \{\n\s*this\.heap\.splice\(idx, 1\);\n\s*return true;/m,
`const idx = this.heap.findIndex(h => this.getItemId(h) === id);
        if (idx >= 0) {
            const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            return true;`);

// Update clear
code = code.replace(/this\.heap = \[\];\n\s*this\.clearStats\(\);/m,
`this.heap = [];
        this._totalPriority = 0;
        this.clearStats();`);

// Update sample call
if (!code.includes('const result = strategy(this.heap, objective, this);')) {
    code = code.replace(/const result = strategy\(this\.heap, objective\);/m, "const result = strategy(this.heap, objective, this);");
}

fs.writeFileSync('src/nar/memory/bag.ts', code);
