import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.resolve(__dirname, '../../examples');
const OUTPUT_FILE = path.resolve(__dirname, '../../ui/examples.json');

const ALLOWED_EXTENSIONS = ['.metta', '.nars'];

function scanDirectory(dir) {
    const name = path.basename(dir);
    const items = fs.readdirSync(dir, { withFileTypes: true });

    const children = [];

    for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(path.resolve(__dirname, '../..'), fullPath);

        if (item.isDirectory()) {
            const subDir = scanDirectory(fullPath);
            if (subDir.children.length > 0) {
                children.push(subDir);
            }
        } else if (item.isFile() && ALLOWED_EXTENSIONS.includes(path.extname(item.name))) {
            children.push({
                id: relativePath.replace(/[\/\\]/g, '-'),
                name: item.name,
                path: relativePath, // e.g. "examples/metta/demos/adaptive_reasoning.metta"
                type: 'file',
                extension: path.extname(item.name)
            });
        }
    }

    return {
        id: path.relative(path.resolve(__dirname, '../..'), dir).replace(/[\/\\]/g, '-') || 'root',
        name: name,
        type: 'directory',
        children: children
    };
}

console.log(`Scanning ${EXAMPLES_DIR}...`);
if (fs.existsSync(EXAMPLES_DIR)) {
    const tree = scanDirectory(EXAMPLES_DIR);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
    console.log(`Examples index written to ${OUTPUT_FILE}`);
    console.log(`Total root children: ${tree.children.length}`);
} else {
    console.error(`Examples directory not found: ${EXAMPLES_DIR}`);
    process.exit(1);
}
