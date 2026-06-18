const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \?\n\s*\{ f: \(parsed\.truth\?\.f \?\? 0\.5\) as any, c: \(parsed\.truth\?\.c \?\? 0\.9\) as any \}\n\s*: undefined;/g, "const truth = (parsed.truth ? { f: parsed.truth.f, c: parsed.truth.c } : undefined) as any;");
replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \? \{f: parsed\.truth\.f, c: parsed\.truth\.c\} : undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");
replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\}\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");


replaceRegexFile('src/nar/nar.ts', /truth: parsed\.truth/g, "truth: parsed.truth as any");
replaceRegexFile('src/nar/nar.ts', /\{ f: \(parsed\.truth\?\.f \?\? 0\.5\) as any, c: \(parsed\.truth\?\.c \?\? 0\.9\) as any \}/g, "{ f: parsed.truth?.f ?? 0.5, c: parsed.truth?.c ?? 0.9 } as any");
replaceRegexFile('src/nar/nar.ts', /const truth = parsed\.truth \? \{f: parsed\.truth\.f, c: parsed\.truth\.c\} : undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");
replaceRegexFile('src/nar/nar.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\}\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");

replaceRegexFile('src/nar/query/api.ts', /truth: belief\.truth as any!/g, "truth: belief.truth as any,");
replaceRegexFile('src/nar/query/api.ts', /truth: belief\.truth as any,/g, "truth: belief.truth as any,");

replaceRegexFile('src/nar/query/api.ts', /const dummyStamp = \{\n\s*id: '',\n\s*creationTime: Date\.now\(\) as any,\n\s*source: 'INPUT' as const,\n\s*derivations: \[\],\n\s*depth: 0 as const\n\s*\} as any;/g, "");
replaceRegexFile('src/nar/query/api.ts', /stamp: belief\.stamp \?\? dummyStamp/g, "stamp: belief.stamp ?? ({ id: '', creationTime: Date.now() as any, source: 'INPUT', derivations: [], depth: 0 } as any)");

replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime: task\.occurrenceTime \?\? Date\.now\(\) as any/g, "occurrenceTime: (task.occurrenceTime ?? Date.now()) as any");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime: belief\.occurrenceTime \?\? Date\.now\(\) as any/g, "occurrenceTime: (belief.occurrenceTime ?? Date.now()) as any");
