const fs = require('fs');

function addImports(path, importsString) {
    let content = fs.readFileSync(path, 'utf8');
    if (!content.includes(importsString.split('{')[1].split('}')[0].trim())) {
        content = importsString + "\n" + content;
        fs.writeFileSync(path, content);
    }
}

addImports('src/nar/nar.ts', "import {Truth} from './terms/truth.js';");
addImports('src/nar/query/api.ts', "import {Truth} from '../terms/truth.js';\nimport {createTimestamp} from '../types/core.js';");
addImports('src/nar/stream/pipeline.ts', "import {createTimestamp} from '../types/core.js';");

let ctf = fs.readFileSync('src/nar/reason/counterfactual.ts', 'utf8');
ctf = ctf.replace("import type {Truth} from '../terms/truth.js';", "import {Truth} from '../terms/truth.js';");
fs.writeFileSync('src/nar/reason/counterfactual.ts', ctf);
