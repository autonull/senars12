const fs = require('fs');

function replaceFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}
function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}


replaceRegexFile('src/agent/input-processor.ts', /truth:\s*\{\s*f:\s*parsed\.truth\?\.f\s*\?\?\s*0\.5,\s*c:\s*parsed\.truth\?\.c\s*\?\?\s*0\.9\s*\}/g, "truth: { f: (parsed.truth?.f ?? 0.5) as any, c: (parsed.truth?.c ?? 0.9) as any }");

replaceRegexFile('src/nar/grounding.ts', /f:\s*0\.9,\s*c:\s*sourceQuality/g, "f: 0.9 as any, c: sourceQuality as any");

replaceRegexFile('src/nar/nar.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
replaceRegexFile('src/nar/nar.ts', /truth:\s*\{\s*f:\s*0\.5,\s*c:\s*0\.9\s*\}/g, "truth: { f: 0.5 as any, c: 0.9 as any }");

replaceRegexFile('src/nar/query/api.ts', /truth:\s*\{\s*f:\s*0\.5,\s*c:\s*0\.9\s*\}/g, "truth: { f: 0.5 as any, c: 0.9 as any }");
replaceRegexFile('src/nar/query/api.ts', /creationTime:\s*Date\.now\(\)/g, "creationTime: Date.now() as any");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");

replaceRegexFile('src/nar/reason/counterfactual.ts', /truth:\s*\{\s*f:\s*Math\.max\(0,\s*Math\.min\(1,\s*baseTask\.truth\.f\s*\+\s*amount\)\),\s*c:\s*baseTask\.truth\.c\s*\}/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)) as any, c: baseTask.truth.c }");

replaceRegexFile('src/nar/reason/inference-controller.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");

replaceRegexFile('src/nar/reason/reasoner.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");

replaceRegexFile('src/nar/reason/strategies/index.ts', /creationTime:\s*0/g, "creationTime: 0 as any");
replaceRegexFile('src/nar/reason/strategies/index.ts', /occurrenceTime:\s*0/g, "occurrenceTime: 0 as any");

replaceRegexFile('src/nar/strategies/derivation/DefaultDerivation.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");

replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
