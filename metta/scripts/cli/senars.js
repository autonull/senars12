#!/usr/bin/env node

import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const command = args[0] || 'help';

function showHelp() {
    console.log(`
Usage: node scripts/cli/senars.js [command]

Commands:
  repl        Start interactive REPL (experimental)
  help        Show this help message
    `);
}

switch (command) {
    case 'help':
    case '--help':
    case '-h':
    default:
        showHelp();
        break;
}
