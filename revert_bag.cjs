const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/bag.ts', 'utf8');
code = code.replace(/this\._totalPriority \+= priority;\n/g, "");
code = code.replace(/this\._totalPriority -= entry\.priority;\n/g, "");
code = code.replace(/const e = this\.heap\[idx\];\n\s*if \(e\) this\._totalPriority -= e\.priority;\n/g, "");
code = code.replace(/this\._totalPriority = 0;\n/g, "");

fs.writeFileSync('src/nar/memory/bag.ts', code);
