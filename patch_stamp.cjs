const fs = require('fs');
let code = fs.readFileSync('src/nar/terms/stamp.ts', 'utf8');

code = code.replace("import type {Increment, Nat} from '../types';", "import type {Increment, Nat, Timestamp} from '../types';\nimport {createTimestamp} from '../types';");

code = code.replace(/readonly creationTime: number;/g, "readonly creationTime: Timestamp;");

code = code.replace(/creationTime: Date.now\(\),/g, "creationTime: createTimestamp(),");

fs.writeFileSync('src/nar/terms/stamp.ts', code);
