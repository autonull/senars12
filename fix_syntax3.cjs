const fs = require('fs');

function replaceRegexFile(path, from, to) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(from, to);
    fs.writeFileSync(path, code);
}

replaceRegexFile('src/agent/input-processor.ts', /await nar\.believe\(b\.narsese, b\.truth\);/g, "await nar.believe(b.narsese, b.truth as any);");

replaceRegexFile('src/nar/nar.ts', /await this\.believe\(t\.term, t\.truth\);/g, "await this.believe(t.term, t.truth as any);");
