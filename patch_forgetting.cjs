const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/lifecycle/forgetting.ts', 'utf8');

const policyReplace = `export type ForgettingPolicy =
    | 'fifo'
    | 'lowest-priority'
    | 'forgetting-curve'
    | { type: 'age'; maxAgeMs: number }
    | { type: 'composite'; weights: { priority: number; age: number } };`;
code = code.replace(/export type ForgettingPolicy =[\s\S]*?\};/m, policyReplace);

const selectorReplace = `'lowest-priority': (concepts) => this.selectLowestPriority(concepts),
        'forgetting-curve': (concepts, scorer) => this.selectByForgettingCurve(concepts, scorer),`;
code = code.replace(/'lowest-priority': \(concepts\) => this\.selectLowestPriority\(concepts\),/m, selectorReplace);

const newMethod = `
    private selectByForgettingCurve(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
        if (concepts.length === 0) return undefined;
        // Ebbinghaus curve: retrievability = e^(-t / S)
        // Here we select the item with the lowest retrievability to forget.
        // t = elapsed time in seconds, S = memory strength (scorer.score(c) scaled)
        let victim: Concept | undefined;
        let lowestRetrievability = Infinity;
        const now = Date.now();

        for (const c of concepts) {
            const t = Math.max(0.1, (now - this.getLastAccess(c)) / 1000); // minimum 0.1s to avoid division by zero later if inverted
            const s = Math.max(0.01, scorer.scoreForForgetting(c) * 100); // scale strength to 1-100 range
            const retrievability = Math.exp(-t / s);

            if (retrievability < lowestRetrievability) {
                lowestRetrievability = retrievability;
                victim = c;
            }
        }
        return victim;
    }

    private selectByAge(concepts: Concept[]): Concept | undefined {`;

code = code.replace(/private selectByAge\(concepts: Concept\[\]\): Concept \| undefined \{/m, newMethod);

fs.writeFileSync('src/nar/memory/lifecycle/forgetting.ts', code);
