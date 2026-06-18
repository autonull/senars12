const fs = require('fs');

let input = fs.readFileSync('src/agent/input-processor.ts', 'utf8');
input = input.replace(/\{ f: \(parsed\.truth\?\.f \?\? 0\.5\) as any, c: \(parsed\.truth\?\.c \?\? 0\.9\) as any \}/g, "({ f: (parsed.truth?.f ?? 0.5), c: (parsed.truth?.c ?? 0.9) } as any)");
input = input.replace(/truth: parsed\.truth/g, "truth: parsed.truth as any");
fs.writeFileSync('src/agent/input-processor.ts', input);

let ground = fs.readFileSync('src/nar/grounding.ts', 'utf8');
ground = ground.replace(/f: 0\.9, c: sourceQuality/g, "f: 0.9 as any, c: sourceQuality as any");
fs.writeFileSync('src/nar/grounding.ts', ground);

let nar = fs.readFileSync('src/nar/nar.ts', 'utf8');
nar = nar.replace(/truth: parsed\.truth/g, "truth: parsed.truth as any");
fs.writeFileSync('src/nar/nar.ts', nar);

let api = fs.readFileSync('src/nar/query/api.ts', 'utf8');
api = api.replace(/truth: query\.truthFilter \? \{f: 0\.5, c: 0\.9\} : undefined/g, "truth: (query.truthFilter ? {f: 0.5, c: 0.9} : undefined) as any");
api = api.replace(/creationTime: Date\.now\(\)/g, "creationTime: Date.now() as any");
api = api.replace(/occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
fs.writeFileSync('src/nar/query/api.ts', api);

let counter = fs.readFileSync('src/nar/reason/counterfactual.ts', 'utf8');
counter = counter.replace(/truth: \{\n\s*f: Math\.max\(0, Math\.min\(1, baseTask\.truth\.f \+ amount\)\),\n\s*c: baseTask\.truth\.c\n\s*\}/g, "truth: { f: Math.max(0, Math.min(1, baseTask.truth.f + amount)), c: baseTask.truth.c } as any");
fs.writeFileSync('src/nar/reason/counterfactual.ts', counter);

let pipe = fs.readFileSync('src/nar/stream/pipeline.ts', 'utf8');
pipe = pipe.replace(/occurrenceTime: Date\.now\(\)/g, "occurrenceTime: Date.now() as any");
fs.writeFileSync('src/nar/stream/pipeline.ts', pipe);
