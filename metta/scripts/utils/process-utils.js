#!/usr/bin/env node

import {exec, spawn} from 'child_process';
import {promisify} from 'util';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Process execution utilities
 */
export const ProcessUtils = {
    /**
     * Get base directory path
     */
    getBaseDir: () => join(__dirname, '../..'),

    /**
     * Execute a command and return a promise
     */
    executeCommand: (command, options = {}) => {
        return new Promise((resolve, reject) => {
            const defaultOptions = {
                cwd: ProcessUtils.getBaseDir(),
                stdio: ['pipe', 'pipe', 'pipe']
            };

            const execOptions = {...defaultOptions, ...options};

            const child = exec(command, execOptions, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({stdout, stderr});
                }
            });
        });
    },

    /**
     * Spawn a process and capture its output
     */
    spawnProcess: (command, args, options = {}) => {
        return new Promise((resolve, reject) => {
            const defaultOptions = {
                cwd: ProcessUtils.getBaseDir(),
                stdio: ['pipe', 'pipe', 'pipe']
            };

            const spawnOptions = {...defaultOptions, ...options};

            const child = spawn(command, args, spawnOptions);

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                resolve({code, stdout, stderr});
            });
        });
    },

    /**
     * Execute a node script with specific environment
     */
    executeNodeScript: (scriptPath, env = {}) => {
        return ProcessUtils.spawnProcess('node', [scriptPath], {
            env: {...process.env, ...env}
        });
    }
};

export default ProcessUtils;