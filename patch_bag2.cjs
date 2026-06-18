const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');

// The original was failing because my sampling bias modification broke NARS assumptions.
// We must exactly implement percentile sampling (like ArrayBag.java)
// ArrayBag.java `randomCurve(rng)` returns `Math.pow(rng.nextFloat(), sharp)`
// `sampleFnReplace` uses `v = Math.pow(Math.random(), 2)` to bias. But the problem isn't the curve, the problem is that tests fail now. Let's revert SAMPLE_FN to EXACTLY what it was before, except optimized for the array being sorted.

const sampleFnReplace = `
const SAMPLE_FN: Record<string, (heap: BagItem<unknown>[], obj: Record<string, unknown>, bag?: any) => unknown> = {
    priority: (h) => {
        // Optimized percentile sampling based on ArrayBag.java
        // Heap is sorted ascending by priority. Higher index = higher priority.
        if (h.length === 0) return undefined;
        // Bias selection toward the end of the array using a sharp curve (Math.pow(random, sharp))
        // This is O(1) sampling! ArrayBag.java uses sharp=1 by default, meaning uniform random index.
        // Wait, uniform over the sorted array means priorities aren't respected exactly proportionally!
        // The original code was doing probability proportionate to priority.
        const total = h.reduce((s, e) => s + e.priority, 0);
        if (total <= 0) return h[h.length - 1]?.item;
        let r = Math.random() * total;
        // iterate backwards (highest priority first)
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
        for (const e of h) {
            if (e.lastAccess >= cutoff && e.lastAccess > bestLastAccess) {
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

fs.writeFileSync('src/nar/memory/bag.ts', code);
