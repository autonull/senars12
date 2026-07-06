#!/usr/bin/env node

import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base configuration
const BASE_DIR = join(__dirname, '../..');

export {
    BASE_DIR,
    getBaseDir,
    getScriptDir,
    parseArgs,
    showUsageAndExit,
    spawnProcess,
    parseKeyValueArgs,
    findArgValue
};

const getBaseDir = () => BASE_DIR;

const getScriptDir = (scriptFileURL) => {
    const scriptFilename = fileURLToPath(scriptFileURL);
    return dirname(scriptFilename);
};

const parseArgs = (rawArgs, helpFlags = ['--help', '-h']) => {
    const args = [...rawArgs];
    const helpRequested = args.some(arg => helpFlags.includes(arg));

    return {args, helpRequested};
};

const showUsageAndExit = (message, exitCode = 0) => {
    console.log(message);
    process.exit(exitCode);
};

const spawnProcess = (command, args, options = {}) => {
    const defaultOptions = {
        stdio: 'inherit',
        cwd: BASE_DIR
    };

    const spawnOptions = {...defaultOptions, ...options};

    const child = spawn(command, args, spawnOptions);

    child.on('error', (err) => {
        console.error(`Error running ${command}:`, err.message);
        process.exit(1);
    });

    child.on('close', (code) => process.exit(code));

    return child;
};

const parseKeyValueArgs = (args, keyMap) => {
    const result = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (keyMap[arg] && args[i + 1]) {
            const key = keyMap[arg];
            result[key] = args[i + 1];
            i++; // Skip the next argument since it's the value
        }
    }

    return result;
};

const findArgValue = (args, optionList) => {
    for (let i = 0; i < args.length; i++) {
        if (optionList.includes(args[i].replace(/^--/, ''))) {
            return args[i].replace(/^--/, '');
        }
    }
    return null;
};