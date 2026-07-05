#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

const EXCLUDE_DIRS = ['node_modules', '.git', 'docs', 'coverage'];
const EXCLUDE_FILES = ['TermFactory.js', 'Term.js', 'factories.js', 'lint-patterns.js', 'check_term_instantiation.js', 'narsese.peggy', 'peggy-parser.js'];

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (EXCLUDE_DIRS.includes(file)) return;
            getAllFiles(filePath, fileList);
        } else {
            if (filePath.endsWith('.js') && !EXCLUDE_FILES.includes(file)) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

const patterns = [
    {
        regex: /new Term\(/g,
        message: "Direct 'new Term(' usage found. Prefer TermFactory methods."
    },
    {
        regex: /termFactory\.create\(\{/g,
        message: "Verbose 'termFactory.create({...})' found. Use specific methods like atomic(), inheritance(), etc."
    },
    {
        regex: /termFactory\.create\(['"`][^'"`]+['"`]\)/g,
        message: "Generic 'termFactory.create(string)' found. Use 'termFactory.atomic(string)'."
    },
    {
        regex: /termFactory\.create\(`[^`]+`\)/g,
        message: "Generic 'termFactory.create(`string`)' found. Use 'termFactory.atomic(`string`)'."
    },
    {
        regex: /termFactory\.create\(['"`](-->|<->|==>|<=>|&&|\|\||&\||\*|\/|\\|\^|==)['"`]/g,
        message: "Generic 'termFactory.create(op, ...)' found. Use specific methods like inheritance(), similarity(), etc."
    }
];

function scanFiles() {
    const files = getAllFiles(rootDir);
    let errorCount = 0;

    console.log(`Scanning ${files.length} files for anti-patterns...\n`);

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(rootDir, file);
        let fileHasError = false;

        patterns.forEach(pattern => {
            const matches = content.match(pattern.regex);
            if (matches) {
                if (!fileHasError) {
                    console.log(`\nFile: ${relativePath}`);
                    fileHasError = true;
                }
                console.log(`  [${matches.length}x] ${pattern.message}`);

                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (pattern.regex.test(line)) {
                        console.log(`    Line ${index + 1}: ${line.trim()}`);
                    }
                });
                errorCount += matches.length;
            }
        });
    });

    console.log(`\nScan complete. Found ${errorCount} potential issues.`);
    if (errorCount > 0) {
        process.exit(1);
    }
}

scanFiles();
