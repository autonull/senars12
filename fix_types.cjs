const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

// Replace 'as any' with createTimestamp() or Truth.create()
// Truth is createTruth() from truth.ts which enforces Confidence and Frequency bounds.
// In truth.ts: createTruth = (f: number, c: number): Truth => ... it's exported as Truth.create(f,c).
// We should import Truth in all those files and use Truth.create(f,c) and createTimestamp(Date.now()).

// 1. src/agent/input-processor.ts
replaceRegexFile('src/agent/input-processor.ts',
/const truth = \(parsed\.truth \? \{f: parsed\.truth\.f, c: parsed\.truth\.c\} : undefined\) as any;/g,
"const truth = parsed.truth ? Truth.create(parsed.truth.f, parsed.truth.c) : undefined;");
replaceRegexFile('src/agent/input-processor.ts',
/truth: \{ f: \(parsed\.truth\?\.f \?\? 0\.5\) as any, c: \(parsed\.truth\?\.c \?\? 0\.9\) as any \}/g,
"truth: Truth.create(parsed.truth?.f ?? 0.5, parsed.truth?.c ?? 0.9)");
replaceRegexFile('src/agent/input-processor.ts',
/truth: parsed\.truth as any/g,
"truth: parsed.truth ? Truth.create(parsed.truth.f, parsed.truth.c) : Truth.NEUTRAL");

// 2. src/nar/grounding.ts
replaceRegexFile('src/nar/grounding.ts',
/truth: \{ f: 0\.9 as any, c: sourceQuality as any \} as any/g,
"truth: Truth.create(0.9, sourceQuality)");

// 3. src/nar/nar.ts
replaceRegexFile('src/nar/nar.ts',
/const truth = \(parsed\.truth \? \{f: parsed\.truth\.f, c: parsed\.truth\.c\} : undefined\) as any;/g,
"const truth = parsed.truth ? Truth.create(parsed.truth.f, parsed.truth.c) : undefined;");
replaceRegexFile('src/nar/nar.ts',
/truth: parsed\.truth as any/g,
"truth: parsed.truth ? Truth.create(parsed.truth.f, parsed.truth.c) : Truth.NEUTRAL");
replaceRegexFile('src/nar/nar.ts',
/\{ f: parsed\.truth\?\.f \?\? 0\.5, c: parsed\.truth\?\.c \?\? 0\.9 \} as any/g,
"Truth.create(parsed.truth?.f ?? 0.5, parsed.truth?.c ?? 0.9)");
replaceRegexFile('src/nar/nar.ts',
/truth: b\.truth \? \{f: b\.truth\.f, c: b\.truth\.c\} as any : undefined/g,
"truth: b.truth ? Truth.create(b.truth.f, b.truth.c) : undefined");
replaceRegexFile('src/nar/nar.ts',
/truth: g\.truth \? \{f: g\.truth\.f, c: g\.truth\.c\} as any : undefined/g,
"truth: g.truth ? Truth.create(g.truth.f, g.truth.c) : undefined");
replaceRegexFile('src/nar/nar.ts',
/truth: q\.truth \? \{f: q\.truth\.f, c: q\.truth\.c\} as any : undefined/g,
"truth: q.truth ? Truth.create(q.truth.f, q.truth.c) : undefined");


// 4. src/nar/query/api.ts
replaceRegexFile('src/nar/query/api.ts',
/const filterTruth = \(query\.truthFilter \? \{f: 0\.5 as any, c: 0\.9 as any\} : undefined\);/g,
"const filterTruth = query.truthFilter ? Truth.create(0.5, 0.9) : undefined;");
replaceRegexFile('src/nar/query/api.ts',
/truth: filterTruth as any/g,
"truth: filterTruth");
replaceRegexFile('src/nar/query/api.ts',
/truth: belief\.truth as any,/g,
"truth: belief.truth ? Truth.create(belief.truth.f, belief.truth.c) : Truth.NEUTRAL,");
replaceRegexFile('src/nar/query/api.ts',
/creationTime: Date\.now\(\) as any/g,
"creationTime: createTimestamp(Date.now())");
replaceRegexFile('src/nar/query/api.ts',
/occurrenceTime: \(belief\.occurrenceTime \?\? Date\.now\(\)\) as any,/g,
"occurrenceTime: createTimestamp(belief.occurrenceTime ?? Date.now()),");
replaceRegexFile('src/nar/query/api.ts',
/occurrenceTime: 0 as any,/g,
"occurrenceTime: createTimestamp(0),");

// 5. src/nar/reason/counterfactual.ts
replaceRegexFile('src/nar/reason/counterfactual.ts',
/truth: \{ f: Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\) as any, c: baseTask\.truth\.c \} as any/g,
"truth: Truth.create(Math.max(0, Math.min(1, baseTask.truth.f + amount)), baseTask.truth.c)");
replaceRegexFile('src/nar/reason/counterfactual.ts',
/\? \{ f: negate \? 1 - originalTruth\.f : originalTruth\.f, c: originalTruth\.c \* 0\.5 \} as any\n\s*: \{ f: negate \? 0 : 1, c: 0\.5 \} as any;/g,
"? Truth.create(negate ? 1 - originalTruth.f : originalTruth.f, originalTruth.c * 0.5)\n        : Truth.create(negate ? 0 : 1, 0.5);");

// 6. src/nar/stream/pipeline.ts
replaceRegexFile('src/nar/stream/pipeline.ts',
/occurrenceTime: \(task\.occurrenceTime \?\? Date\.now\(\)\) as any,/g,
"occurrenceTime: createTimestamp(task.occurrenceTime ?? Date.now()),");
replaceRegexFile('src/nar/stream/pipeline.ts',
/occurrenceTime: 0 as any,/g,
"occurrenceTime: createTimestamp(0),");

// 7. Insert createTimestamp imports
function ensureImport(path) {
    let content = fs.readFileSync(path, 'utf8');
    if (!content.includes('createTimestamp')) {
        content = "import {createTimestamp} from '../types/core.js';\n" + content;
        fs.writeFileSync(path, content);
    }
}
ensureImport('src/nar/query/api.ts');
ensureImport('src/nar/stream/pipeline.ts');
