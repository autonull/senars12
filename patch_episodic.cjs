const fs = require('fs');

let code = fs.readFileSync('src/nar/memory/EpisodicMemory.ts', 'utf8');

const replaceLines = `
                const filePath = join(basePath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split('\\n').filter(line => line.trim());

                // Read backwards to get newest episodes first
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    if (!line) continue;
                    try {
                        const episode = JSON.parse(line) as Episode;
`;

code = code.replace(/const filePath = join\(basePath, file\);\s*const content = await fs\.readFile\(filePath, 'utf-8'\);\s*const lines = content\.split\('\\n'\)\.filter\(line => line\.trim\(\)\);\s*for \(const line of lines\) \{\s*try \{\s*const episode = JSON\.parse\(line\) as Episode;/m, replaceLines);

fs.writeFileSync('src/nar/memory/EpisodicMemory.ts', code);
