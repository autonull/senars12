const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /truth:\s*parsed\.truth/g, "truth: parsed.truth as any");
replaceRegexFile('src/nar/grounding.ts', /return \{\s*term:\s*atom\('success'\),\s*truth:\s*\{\s*f:\s*0\.9,\s*c:\s*sourceQuality\s*\}\s*\};/g, "return {term: atom('success'), truth: {f: 0.9 as any, c: sourceQuality as any}};");
replaceRegexFile('src/nar/nar.ts', /truth:\s*belief\.truth/g, "truth: belief.truth as any");
replaceRegexFile('src/nar/query/api.ts', /truth:\s*query\.truthFilter\s*\?\s*\{f:\s*0\.5,\s*c:\s*0\.9\}\s*:\s*undefined/g, "truth: (query.truthFilter ? {f: 0.5, c: 0.9} : undefined) as any");
replaceRegexFile('src/nar/query/api.ts', /creationTime:\s*Date\.now\(\)/g, "creationTime: Date.now() as any");
replaceRegexFile('src/nar/query/api.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
replaceRegexFile('src/nar/reason/counterfactual.ts', /truth:\s*\{\s*f:\s*Math\.max\(0,\s*Math\.min\(1,\s*baseTask\.truth\.f\s*\+\s*amount\)\),\s*c:\s*baseTask\.truth\.c\s*\}/g, "truth: {f: Math.max(0, Math.min(1, baseTask.truth.f + amount)) as any, c: baseTask.truth.c}");
replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime:\s*Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
