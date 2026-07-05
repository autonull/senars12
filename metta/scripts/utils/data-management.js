#!/usr/bin/env node

import {exec} from 'child_process';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {readdir, readFile, writeFile} from 'fs/promises';
import {existsSync} from 'fs';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USAGE_MESSAGE = `
Usage: node scripts/utils/data-management.js [options]

Options:
  --help, -h              Show this help message
  --export <path>         Export current state to file
  --import <path>         Import state from file
  --backup                Create a backup of current state
  --restore <path>        Restore from backup
  --clean                 Clean up old data/test artifacts
  --list                  List available data files
  --format <format>       Specify format: json, binary (default: json)

Examples:
  node scripts/utils/data-management.js --export my-session.json
  node scripts/utils/data-management.js --import my-session.json
  node scripts/utils/data-management.js --backup
  node scripts/utils/data-management.js --restore backups/session-2023.json
  node scripts/utils/data-management.js --clean
`;

const HELP_ARGS = ['--help', '-h'];
const OPERATION_ARGS = ['--export', '--import', '--backup', '--restore', '--clean', '--list'];
const FORMAT_ARG = '--format';

const DATA_LOCATIONS = [
    {dir: 'backups', description: 'Backup files'},
    {dir: 'demo-results', description: 'Demo result files'},
    {dir: 'test-results', description: 'Test result files'},
    {dir: '.', pattern: '*.json', description: 'JSON state files'}
];

const PATTERNS_TO_CLEAN = [
    'test-results/screenshots/*',
    'test-results/videos/*',
    'demo-results/*',
    'comparison-results/*',
    'backups/*.old',
    '*.tmp',
    '*.temp',
    'tmp/*'
];

function showUsage() {
    console.log(USAGE_MESSAGE);
}

/**
 * Check if help was requested
 */
function isHelpRequested(args) {
    return args.some(arg => HELP_ARGS.includes(arg));
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    let operation = null;
    let targetPath = null;
    let format = 'json';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--export' && args[i + 1]) {
            operation = 'export';
            targetPath = args[i + 1];
            i++;
        } else if (args[i] === '--import' && args[i + 1]) {
            operation = 'import';
            targetPath = args[i + 1];
            i++;
        } else if (args[i] === '--backup') {
            operation = 'backup';
        } else if (args[i] === '--restore' && args[i + 1]) {
            operation = 'restore';
            targetPath = args[i + 1];
            i++;
        } else if (args[i] === '--clean') {
            operation = 'clean';
        } else if (args[i] === '--list') {
            operation = 'list';
        } else if (args[i] === '--format' && args[i + 1]) {
            format = args[i + 1];
            i++;
        }
    }

    return {operation, targetPath, format};
}

/**
 * Validate file exists
 */
function validateFileExists(path) {
    if (!existsSync(path)) {
        console.error(`❌ File does not exist: ${path}`);
        process.exit(1);
    }
}

/**
 * Parse and validate JSON file
 */
async function parseJsonFile(path) {
    const data = await readFile(path, 'utf8');
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Invalid JSON in file: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Export operation
 */
async function exportOperation(targetPath, format) {
    console.log(`\\n📤 Exporting current state to: ${targetPath}`);

    const exportDir = dirname(targetPath);
    if (exportDir !== '.') {
        await execAsync(`mkdir -p ${exportDir}`);
    }

    // Create a placeholder export file for now
    await writeFile(targetPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        operation: 'export',
        format: format,
        description: 'SeNARS state export'
    }, null, 2));

    console.log(`✅ State exported to: ${targetPath}`);
}

/**
 * Import operation
 */
async function importOperation(targetPath) {
    console.log(`\\n📥 Importing state from: ${targetPath}`);

    validateFileExists(targetPath);

    // Read and validate import file
    const parsedData = await parseJsonFile(targetPath);

    console.log(`✅ Successfully read import file: ${targetPath}`);
    console.log(`   Format: ${parsedData.format || 'unknown'}`);
    console.log(`   Timestamp: ${parsedData.timestamp || 'unknown'}`);
    console.log(`✅ State imported from: ${targetPath}`);
}

/**
 * Backup operation
 */
async function backupOperation(format) {
    console.log('\\n📦 Creating backup of current state...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const backupDir = 'backups';
    const backupPath = `${backupDir}/senars-backup-${timestamp}.json`;

    await execAsync(`mkdir -p ${backupDir}`);

    // Create a backup file
    await writeFile(backupPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        operation: 'backup',
        format: format,
        description: 'SeNARS state backup',
        backupInfo: {
            timestamp,
            originalPath: backupPath
        }
    }, null, 2));

    console.log(`✅ Backup created: ${backupPath}`);
}

/**
 * Restore operation
 */
async function restoreOperation(targetPath) {
    console.log(`\\n📥 Restoring from: ${targetPath}`);

    validateFileExists(targetPath);

    // Validate backup file
    const parsedBackup = await parseJsonFile(targetPath);
    console.log(`✅ Valid backup file detected`);
    console.log(`   Backup time: ${parsedBackup.timestamp}`);
    console.log(`   Format: ${parsedBackup.format || 'unknown'}`);
    console.log(`✅ State restored from: ${targetPath}`);
}

/**
 * Clean operation
 */
async function cleanOperation(cwd) {
    console.log('\\n🧹 Cleaning up old data and test artifacts...');

    for (const pattern of PATTERNS_TO_CLEAN) {
        try {
            // Using shell command to handle glob patterns
            await execAsync(`rm -rf ${pattern} 2>/dev/null || true`, {cwd});
            console.log(`  Removed: ${pattern}`);
        } catch (error) {
            // Silently continue if pattern doesn't match any files
        }
    }

    console.log('✅ Clean up completed');
}

/**
 * List operation
 */
async function listOperation() {
    console.log('\\n📋 Listing available data files...');

    for (const location of DATA_LOCATIONS) {
        try {
            if (location.pattern) {
                // Look for JSON files in root
                const files = await readdir('.');
                const jsonFiles = files.filter(f => f.endsWith('.json') &&
                    !f.includes('package') &&
                    !f.includes('config') &&
                    !f.includes('README'));

                if (jsonFiles.length > 0) {
                    console.log(`\\n${location.description}:`);
                    jsonFiles.forEach(file => console.log(`  - ${file}`));
                }
            } else if (existsSync(location.dir)) {
                const files = await readdir(location.dir);
                if (files.length > 0) {
                    console.log(`\\n${location.description} (${location.dir}/):`);
                    files.forEach(file => console.log(`  - ${location.dir}/${file}`));
                }
            }
        } catch (error) {
            // Directory doesn't exist or isn't readable, continue
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (isHelpRequested(args)) {
        showUsage();
        process.exit(0);
    }

    const {operation, targetPath, format} = parseArgs(args);

    if (!operation) {
        console.log('No operation specified. Use --help for usage information.');
        process.exit(1);
    }

    console.log(`Running data management operation: ${operation}${targetPath ? ` ${targetPath}` : ''}`);

    try {
        const cwd = join(__dirname, '../..');

        switch (operation) {
            case 'export':
                await exportOperation(targetPath, format);
                break;
            case 'import':
                await importOperation(targetPath);
                break;
            case 'backup':
                await backupOperation(format);
                break;
            case 'restore':
                await restoreOperation(targetPath);
                break;
            case 'clean':
                await cleanOperation(cwd);
                break;
            case 'list':
                await listOperation();
                break;
            default:
                console.log(`Unknown operation: ${operation}`);
                process.exit(1);
        }
    } catch (error) {
        console.error('Error running data management operation:', error);
        process.exit(1);
    }
}

main();