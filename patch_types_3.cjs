const fs = require('fs');
let code;

code = fs.readFileSync('src/agent/input-processor.ts', 'utf8');
code = code.replace(/\{ f: \(parsed\.truth\?\.f \?\? 0\.5\) as any, c: \(parsed\.truth\?\.c \?\? 0\.9\) as any \}/g, "{ f: (parsed.truth?.f ?? 0.5) as any, c: (parsed.truth?.c ?? 0.9) as any } as any");
fs.writeFileSync('src/agent/input-processor.ts', code);

code = fs.readFileSync('src/nar/grounding.ts', 'utf8');
code = code.replace(/f: 0\.9,\s*c: sourceQuality/g, "f: 0.9 as any, c: sourceQuality as any");
fs.writeFileSync('src/nar/grounding.ts', code);

code = fs.readFileSync('src/nar/nar.ts', 'utf8');
code = code.replace(/\{ f: 0\.5 as any, c: 0\.9 as any \}/g, "{ f: 0.5, c: 0.9 } as any");
fs.writeFileSync('src/nar/nar.ts', code);

code = fs.readFileSync('src/nar/query/api.ts', 'utf8');
code = code.replace(/truth: query\.truthFilter \? \{f: 0\.5, c: 0\.9\} : undefined/g, "truth: (query.truthFilter ? {f: 0.5, c: 0.9} : undefined) as any");
code = code.replace(/creationTime: Date\.now\(\),/g, "creationTime: Date.now() as any,");
code = code.replace(/occurrenceTime: Date\.now\(\),/g, "occurrenceTime: Date.now() as any,");
fs.writeFileSync('src/nar/query/api.ts', code);

code = fs.readFileSync('src/nar/reason/counterfactual.ts', 'utf8');
code = code.replace(/truth: \{\n\s*f: Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\),\n\s*c: baseTask\.truth\.c\n\s*\}/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)), c: baseTask.truth.c } as any");
fs.writeFileSync('src/nar/reason/counterfactual.ts', code);

code = fs.readFileSync('src/nar/stream/pipeline.ts', 'utf8');
code = code.replace(/occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
fs.writeFileSync('src/nar/stream/pipeline.ts', code);
