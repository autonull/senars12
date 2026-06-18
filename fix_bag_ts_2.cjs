const fs = require('fs');
let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');
code = code.replace(/total \+= h\[i\]\.priority;/g, "total += h[i]!.priority;");
fs.writeFileSync('src/nar/memory/bag.ts', code);
