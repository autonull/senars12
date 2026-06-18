const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/nar/nar.ts', /import type \{Truth as TruthType\} from '\.\/terms\/truth\.js';/g, "import type {Truth as TruthType} from './terms/truth.js';\nimport {Truth} from './terms/truth.js';");
replaceRegexFile('src/nar/query/api.ts', /import type \{Truth as TruthType\} from '\.\.\/terms\/truth\.js';/g, "import type {Truth as TruthType} from '../terms/truth.js';\nimport {Truth} from '../terms/truth.js';\nimport {createTimestamp} from '../types/core.js';");
replaceRegexFile('src/nar/reason/counterfactual.ts', /import type \{Truth\} from '\.\.\/terms';/g, "import {Truth} from '../terms/truth.js';");
replaceRegexFile('src/nar/stream/pipeline.ts', /import \{Task, TaskType, Result\} from '\.\.\/types';/g, "import {Task, TaskType, Result} from '../types/index.js';\nimport {createTimestamp} from '../types/core.js';");
