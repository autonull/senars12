const fs = require('fs');
let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');
code = code.replace(/let total = bag\?\._totalPriority;/g, "let total = bag?._totalPriority ?? 0;");
code = code.replace(/if \(total === undefined \|\| total <= 0\) \{/g, "if (total <= 0) {");
fs.writeFileSync('src/nar/memory/bag.ts', code);
