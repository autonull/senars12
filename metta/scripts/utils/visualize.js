#!/usr/bin/env node

import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

function showUsage() {
    console.log(`
Usage: node scripts/utils/visualize.js [options]

Options:
  --help, -h             Show this help message
  --type <type>          Type: screenshots|priority|derivations|all|movie|gif (default: screenshots)
  --url <url>            URL to capture from (default: http://localhost:5173)
  --duration <ms>        Duration for captures (default: 30000)
  --interval <ms>        Interval between captures (default: 2000)
  --fps <fps>            Frames per second for movies (default: 2)
  --output <path>        Output path (default varies by type)
  --prefix <prefix>      Filename prefix (default: based on type)

Examples:
  node scripts/utils/visualize.js --type screenshots
  node scripts/utils/visualize.js --type priority --duration 60000
  node scripts/utils/visualize.js --type movie --fps 4
  node scripts/utils/visualize.js --type all
    `);
}

if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Set defaults
let captureType = 'screenshots';
let url = 'http://localhost:5173';
let duration = '30000';
let interval = '2000';
let fps = '2';
let output = '';
let prefix = '';

// Parse arguments
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
        captureType = args[i + 1];
        i++;
    } else if (args[i] === '--url' && args[i + 1]) {
        url = args[i + 1];
        i++;
    } else if (args[i] === '--duration' && args[i + 1]) {
        duration = args[i + 1];
        i++;
    } else if (args[i] === '--interval' && args[i + 1]) {
        interval = args[i + 1];
        i++;
    } else if (args[i] === '--fps' && args[i + 1]) {
        fps = args[i + 1];
        i++;
    } else if (args[i] === '--output' && args[i + 1]) {
        output = args[i + 1];
        i++;
    } else if (args[i] === '--prefix' && args[i + 1]) {
        prefix = args[i + 1];
        i++;
    }
}

// Set default prefix based on type if not specified
if (!prefix) {
    prefix = captureType;
}

// Set default output based on type if not specified
if (!output) {
    if (['movie', 'gif'].includes(captureType)) {
        output = `test-results/videos/demo-${captureType}.mp4`;
        if (captureType === 'gif') {
            output = `test-results/videos/demo-${captureType}.gif`;
        }
    } else {
        output = `test-results/screenshots`;
    }
}

// Validate capture type
const validTypes = ['screenshots', 'priority', 'derivations', 'all', 'movie', 'gif'];
if (!validTypes.includes(captureType)) {
    console.error(`Invalid capture type: ${captureType}. Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
}

console.log(`Capturing ${captureType} from ${url} for ${duration}ms...`);

// Determine the appropriate mode based on parameters
let generatorArgs = [
    '--type', captureType,
    '--url', url,
    '--duration', duration,
    '--interval', interval
];

if (output) {
    generatorArgs.push('--output', output);
}

// Run the screenshot generator with appropriate parameters
const child = spawn('node', ['scripts/utils/screenshot-generator.js', ...generatorArgs], {
    stdio: 'inherit',
    cwd: join(__dirname, '../..')
});

child.on('error', (err) => {
    console.error(`Error capturing ${captureType}:`, err.message);
    process.exit(1);
});

child.on('close', (code) => {
    process.exit(code);
});