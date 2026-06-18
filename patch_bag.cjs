const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');

// The ArrayBag.java uses a randomCurve to skew distribution: `v = rng.nextFloat(); return Math.pow(v, sharp);`
// Also `bag.ts` has `SAMPLE_FN`. We can optimize priority sampling by relying on sorting, and use a percentile curve sample.
// Let's implement a percentile sampling method.
const sampleFnReplace = `
const SAMPLE_FN: Record<string, (heap: BagItem<unknown>[], obj: Record<string, unknown>, bag?: any) => unknown> = {
    priority: (h, o, bag) => {
        if (h.length === 0) return undefined;
        // Optimization: the heap is already sorted by priority in ascending order,
        // so the highest priority items are at the end.
        // Using a sharp curve to bias selection towards higher index (highest priority)
        // v = Math.random() ^ sharp (where sharp > 1, e.g., 2 or 3 to strongly favor the end)
        // Or if we want to use exact priority sampling without recalculating total:
        if (bag && bag._totalPriority > 0) {
            let r = Math.random() * bag._totalPriority;
            for (let i = h.length - 1; i >= 0; i--) {
                const e = h[i];
                if (e) {
                    r -= e.priority;
                    if (r <= 0) return e.item;
                }
            }
            return h[0]?.item;
        } else {
            // fallback if _totalPriority is not tracked or accurate
            const total = h.reduce((s, e) => s + e.priority, 0);
            if (total <= 0) return h[h.length - 1]?.item; // highest is at the end
            let r = Math.random() * total;
            for (let i = h.length - 1; i >= 0; i--) {
                const e = h[i];
                if (e) {
                    r -= e.priority;
                    if (r <= 0) return e.item;
                }
            }
            return h[0]?.item;
        }
    },
    recency: (h, o) => {
        const cutoff = Date.now() - (o.windowMs as number);
        // Find most recent instead of just first matching
        let best = undefined;
        let bestLastAccess = -1;
        for (const e of h) {
            if (e.lastAccess >= cutoff && e.lastAccess > bestLastAccess) {
                best = e.item;
                bestLastAccess = e.lastAccess;
            }
        }
        return best;
    },
    novelty: h => h[0]?.item, // Lowest priority (oldest/least important)
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
code = code.replace('private heap: BagItem<T>[] = [];', 'private heap: BagItem<T>[] = [];\n    public _totalPriority = 0;');

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
code = code.replace(/this\.heap\.splice\(idx, 1\);\n\s*this\.trackRemoval\(\);\n\s*return true;/m,
`const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            this.trackRemoval();
            return true;`);

// Update removeById
code = code.replace(/this\.heap\.splice\(idx, 1\);\n\s*return true;/m,
`const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            return true;`);

// Update clear
code = code.replace(/this\.heap = \[\];\n\s*this\.clearStats\(\);/m,
`this.heap = [];
        this._totalPriority = 0;
        this.clearStats();`);

// Update sample call
code = code.replace(/const result = strategy\(this\.heap, objective\);/m, "const result = strategy(this.heap, objective, this);");

fs.writeFileSync('src/nar/memory/bag.ts', code);
