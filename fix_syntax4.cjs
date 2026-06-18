const fs = require('fs');
let code = fs.readFileSync('src/nar/nar.ts', 'utf8');
code = code.replace(/await this\.io\.input\(task\.term, task\.type, task\.truth\);/g, "await this.io.input(task.term, task.type, task.truth as any);");
fs.writeFileSync('src/nar/nar.ts', code);
