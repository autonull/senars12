const fs = require('fs');
let code = fs.readFileSync('src/nar/query/api.ts', 'utf8');
code = code.replace(/truth: belief\.truth as any,,/g, "truth: belief.truth as any,");
code = code.replace(/stamp: belief\.stamp \?\? \{id: '', creationTime: 0, source: 'INPUT' as const, derivations: \[\], depth: 0\}/g, "stamp: belief.stamp ?? ({id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0} as any)");
fs.writeFileSync('src/nar/query/api.ts', code);
