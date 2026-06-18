const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/nar/grounding.ts', /await this\.nar\.believe\(fact, \{f: 0\.9, c: quality\}\);/g, "await this.nar.believe(fact, {f: 0.9, c: quality} as any);");

replaceRegexFile('src/nar/nar.ts', /truth: b\.truth \? \{f: b\.truth\.f, c: b\.truth\.c\} : undefined/g, "truth: b.truth ? {f: b.truth.f, c: b.truth.c} as any : undefined");
replaceRegexFile('src/nar/nar.ts', /truth: g\.truth \? \{f: g\.truth\.f, c: g\.truth\.c\} : undefined/g, "truth: g.truth ? {f: g.truth.f, c: g.truth.c} as any : undefined");
replaceRegexFile('src/nar/nar.ts', /truth: q\.truth \? \{f: q\.truth\.f, c: q\.truth\.c\} : undefined/g, "truth: q.truth ? {f: q.truth.f, c: q.truth.c} as any : undefined");

replaceRegexFile('src/nar/query/api.ts', /private createTaskFromBelief\(term: Term, belief: \{\n\s*truth\?: \{ f: number; c: number \};\n\s*budget: Budget;\n\s*timestamp\?: number;\n\s*stamp\?: Stamp;\n\s*occurrenceTime\?: number;\n\s*derived\?: boolean;\n\s*\}\): Task \{/g,
`private createTaskFromBelief(term: Term, belief: {
        truth?: { f: number; c: number };
        budget: Budget;
        timestamp?: number;
        stamp?: Stamp;
        occurrenceTime?: number;
        derived?: boolean;
    }): Task {
        const dummyStamp = {
            id: '',
            creationTime: Date.now() as any,
            source: 'INPUT' as const,
            derivations: [],
            depth: 0 as const
        } as any;`);

replaceRegexFile('src/nar/query/api.ts', /truth: belief\.truth/g, "truth: belief.truth as any");
replaceRegexFile('src/nar/query/api.ts', /stamp: belief\.stamp \?\? dummyStamp,/g, "stamp: belief.stamp ?? dummyStamp,");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime: belief\.occurrenceTime \?\? Date\.now\(\) as any,/g, "occurrenceTime: belief.occurrenceTime ?? Date.now() as any,");


replaceRegexFile('src/nar/reason/counterfactual.ts', /\? \{ f: negate \? 1 - originalTruth\.f : originalTruth\.f, c: originalTruth\.c \* 0\.5 \}\n\s*: \{ f: negate \? 0 : 1, c: 0\.5 \};/g, "? { f: negate ? 1 - originalTruth.f : originalTruth.f, c: originalTruth.c * 0.5 } as any\n        : { f: negate ? 0 : 1, c: 0.5 } as any;");

replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\}\n\s*: undefined;/g, "const truth = parsed.truth ?\n                    {f: parsed.truth.f, c: parsed.truth.c} as any\n                    : undefined;");
replaceRegexFile('src/agent/input-processor.ts', /await nar\.believe\(parsed\.term, truth\);/g, "await nar.believe(parsed.term, truth as any);");

replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime: task\.occurrenceTime \?\? Date\.now\(\) as any,/g, "occurrenceTime: task.occurrenceTime ?? Date.now() as any,");
