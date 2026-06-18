const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\} as any\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");
replaceRegexFile('src/agent/input-processor.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\}\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");
// wait let's just replace all "truth: {" with "truth: { ... } as any"
replaceRegexFile('src/agent/input-processor.ts', /await generateReasonedResponse\(generationService, input, \[existing as \{term: \{toString\(\): string\}; truth\?: \{f: number; c: number\}\}\]\);/g, "await generateReasonedResponse(generationService, input, [existing as any]);");
replaceRegexFile('src/agent/input-processor.ts', /existing as \{term: \{toString\(\): string\}; truth\?: \{f: number; c: number\}\}/g, "existing as any");

replaceRegexFile('src/nar/nar.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\} as any\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");
replaceRegexFile('src/nar/nar.ts', /const truth = parsed\.truth \?\n\s*\{f: parsed\.truth\.f, c: parsed\.truth\.c\}\n\s*: undefined;/g, "const truth = (parsed.truth ? {f: parsed.truth.f, c: parsed.truth.c} : undefined) as any;");

replaceRegexFile('src/nar/query/api.ts', /occurrenceTime: 0,/g, "occurrenceTime: 0 as any,");
replaceRegexFile('src/nar/stream/pipeline.ts', /occurrenceTime: 0,/g, "occurrenceTime: 0 as any,");
