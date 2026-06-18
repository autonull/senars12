const fs = require('fs');

// Fix core.ts to export Timestamp, Frequency, Confidence properly. Wait, Frequency and Confidence are in truth.ts.
let core = fs.readFileSync('src/nar/types/core.ts', 'utf8');
// core.ts missing export of Truth? wait, truth.ts imports clamp.
// Let's fix truth object structure to Truth in core.ts
core = core.replace(/truth\?: \{ f: number; c: number \}/g, "truth?: TruthType");
core = core.replace(/truth: truth \?\? Truth\.NEUTRAL/g, "truth: (truth as TruthType) ?? Truth.NEUTRAL");

// Also Timestamp and createTimestamp need to be exported in types/index.ts
let index = fs.readFileSync('src/nar/types/index.ts', 'utf8');
if (!index.includes('Timestamp')) {
    index = index.replace("Hash,", "Hash,\n    Timestamp,\n    Duration,");
    index = index.replace("createTask,", "createTask,\n    createTimestamp,\n    createDuration,");
    fs.writeFileSync('src/nar/types/index.ts', index);
}

fs.writeFileSync('src/nar/types/core.ts', core);


let ts = fs.readFileSync('src/nar/terms/stamp.ts', 'utf8');
ts = ts.replace("import type {Increment, Nat, Timestamp} from '../types';", "import type {Increment, Nat, Timestamp} from '../types/index.js';");
ts = ts.replace("import {createTimestamp} from '../types';", "import {createTimestamp} from '../types/index.js';");
fs.writeFileSync('src/nar/terms/stamp.ts', ts);
