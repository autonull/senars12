const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

let content = fs.readFileSync('src/nar/stream/pipeline.ts', 'utf8');
if (!content.includes('import {createTimestamp}')) {
    content = "import {createTimestamp} from '../types/core.js';\n" + content;
    fs.writeFileSync('src/nar/stream/pipeline.ts', content);
} else {
    // If it's imported multiple times or wrong path?
    // Just force it.
    content = content.replace(/import \{createTimestamp\} from '\.\.\/types\/core\.js';/g, "");
    content = "import {createTimestamp} from '../types/core.js';\n" + content;
    fs.writeFileSync('src/nar/stream/pipeline.ts', content);
}
