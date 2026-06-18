const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/nar/reason/counterfactual.ts', /import type \{Term, Truth\} from '\.\.\/terms\/index\.js';/g, "import type {Term} from '../terms/index.js';\nimport {Truth} from '../terms/truth.js';");
replaceRegexFile('src/nar/query/api.ts', /import type \{Term\} from '\.\.\/terms';/g, "import type {Term} from '../terms/index.js';\nimport {Truth} from '../terms/truth.js';\nimport {createTimestamp} from '../types/core.js';");
replaceRegexFile('src/nar/stream/pipeline.ts', /import \{Task, TaskType, Result\} from '\.\.\/types\/index\.js';/g, "import {Task, TaskType, Result} from '../types/index.js';\nimport {createTimestamp} from '../types/core.js';");
