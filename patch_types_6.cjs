const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /\{ f: \(parsed\.truth\?\.f \?\? 0\.5\), c: \(parsed\.truth\?\.c \?\? 0\.9\) \} as any/g, "{ f: (parsed.truth?.f ?? 0.5) as any, c: (parsed.truth?.c ?? 0.9) as any }");
replaceRegexFile('src/agent/input-processor.ts', /truth: parsed\.truth/g, "truth: parsed.truth as any");
replaceRegexFile('src/agent/input-processor.ts', /truth: \{\s*f: parsed\.truth\?\.f \?\? 0\.5,\s*c: parsed\.truth\?\.c \?\? 0\.9\s*\}/g, "truth: { f: (parsed.truth?.f ?? 0.5) as any, c: (parsed.truth?.c ?? 0.9) as any }");

replaceRegexFile('src/nar/grounding.ts', /truth: \{ f: 0\.9 as any, c: sourceQuality as any \}/g, "truth: { f: 0.9 as any, c: sourceQuality as any } as any");

replaceRegexFile('src/nar/nar.ts', /truth: parsed\.truth/g, "truth: parsed.truth as any");

replaceRegexFile('src/nar/query/api.ts', /const filterTruth = query\.truthFilter \? \{f: 0\.5, c: 0\.9\} : undefined;/g, "const filterTruth = (query.truthFilter ? {f: 0.5 as any, c: 0.9 as any} : undefined);");
replaceRegexFile('src/nar/query/api.ts', /truth: filterTruth/g, "truth: filterTruth as any");
replaceRegexFile('src/nar/query/api.ts', /const dummyStamp = \{\n\s*id: '',\n\s*creationTime: Date\.now\(\) as any,\n\s*source: 'INPUT' as const,\n\s*derivations: \[\],\n\s*depth: 0 as const\n\s*\};/g, "const dummyStamp = {\n            id: '',\n            creationTime: Date.now() as any,\n            source: 'INPUT' as const,\n            derivations: [],\n            depth: 0 as const\n        } as any;");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime: Date\.now\(\) as any/g, "occurrenceTime: Date.now() as any");

replaceRegexFile('src/nar/reason/counterfactual.ts', /truth: \{ f: Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\), c: baseTask\.truth\.c \} as any/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)) as any, c: baseTask.truth.c } as any");
replaceRegexFile('src/nar/reason/counterfactual.ts', /truth: \{ f: Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\) as any, c: baseTask\.truth\.c \}/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)) as any, c: baseTask.truth.c }");

replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
