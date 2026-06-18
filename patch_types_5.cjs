const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /\{ f: \(parsed\.truth\?\.f \?\? 0\.5\), c: \(parsed\.truth\?\.c \?\? 0\.9\) \} as any/g, "({ f: (parsed.truth?.f ?? 0.5), c: (parsed.truth?.c ?? 0.9) } as any)");
replaceRegexFile('src/nar/grounding.ts', /truth:\s*\{\s*f:\s*0\.9,\s*c:\s*sourceQuality\s*\}/g, "truth: { f: 0.9, c: sourceQuality } as any");
replaceRegexFile('src/nar/nar.ts', /truth:\s*parsed\.truth/g, "truth: parsed.truth as any");
replaceRegexFile('src/nar/query/api.ts', /truth: query\.truthFilter \? \{f: 0\.5, c: 0\.9\} : undefined/g, "truth: (query.truthFilter ? {f: 0.5, c: 0.9} : undefined) as any");
replaceRegexFile('src/nar/query/api.ts', /creationTime: Date\.now\(\)/g, "creationTime: Date.now() as any");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
replaceRegexFile('src/nar/reason/counterfactual.ts', /truth:\s*\{\s*f:\s*Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\),\s*c:\s*baseTask\.truth\.c\s*\}/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)), c: baseTask.truth.c } as any");
replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
