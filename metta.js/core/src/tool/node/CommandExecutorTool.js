/**
 * @file src/tools/CommandExecutorTool.js
 * @description Tool for executing commands in a sandboxed environment
 */

import {BaseTool} from '../BaseTool.js';
import {exec} from 'child_process';
import path from 'path';
import os from 'os';

/**
 * Tool for executing system commands with safety restrictions
 */
export class CommandExecutorTool extends BaseTool {
    constructor(config = {}) {
        super(config);
        this.name = 'CommandExecutorTool';

        // Configure safety settings
        this.allowedCommands = new Set(config.allowedCommands || [
            'ls', 'dir', 'cat', 'head', 'tail', 'echo', 'date', 'whoami', 'pwd',
            'ps', 'netstat', 'ifconfig', 'df', 'du', 'grep', 'find', 'which', 'whereis',
            'node', 'npm', 'npx', 'git', 'curl', 'wget', 'ping', 'nslookup', 'dig'
        ]);

        this.disallowedCommands = new Set(config.disallowedCommands || [
            'rm', 'rmdir', 'rmtree', 'del', 'format', 'mkfs', 'dd',
            'chmod', 'chown', 'passwd', 'useradd', 'userdel', 'su', 'sudo',
            'mount', 'umount', 'kill', 'killall', 'reboot', 'shutdown'
        ]);

        this.timeout = config.timeout || 10000; // 10 seconds default
        this.maxOutputSize = config.maxOutputSize || 1024 * 100; // 100KB
        this.workingDir = config.workingDir || os.tmpdir();
        this.allowedWorkingDirs = new Set(config.allowedWorkingDirs || [
            os.tmpdir(),
            path.join(process.cwd(), 'temp'),
            path.join(process.cwd(), 'work')
        ]);
    }

    /**
     * Execute a system command
     * @param {object} params - Tool parameters
     * @param {object} context - Execution context
     * @returns {Promise<any>} - Command execution result
     */
    async execute(params, context) {
        const {command, args = [], cwd, env = {}} = params;

        if (!command) {
            throw new Error('Command is required');
        }

        // Validate and sanitize the command
        this._validateCommand(command, args, cwd, env);

        // Use exec for safety since it prevents shell injection better than spawn
        return await this._executeWithTimeout(command, args, cwd, env);
    }

    /**
     * Execute command with timeout and safety
     * @private
     */
    async _executeWithTimeout(command, args, cwd, env) {
        const commandString = [command, ...args].join(' ');
        const startTime = Date.now();

        return new Promise((resolve) => {
            const execOptions = {
                cwd: cwd || this.workingDir,
                timeout: this.timeout,
                maxBuffer: this.maxOutputSize,
                env: {...process.env, ...env}, // Merge with system env
                reject: false // Don't throw on non-zero exit code
            };

            const child = exec(commandString, execOptions, (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;

                if (error) {
                    resolve({
                        success: false,
                        command: commandString,
                        exitCode: error.code === 'ETIMEDOUT' ? null : (typeof error.killed !== 'undefined' ? 1 : null),
                        error: this._createSafeError(error, executionTime),
                        stdout: this._sanitizeOutput(stdout),
                        stderr: this._sanitizeOutput(stderr),
                        executionTime,
                        duration: executionTime
                    });
                } else {
                    resolve({
                        success: true,
                        command: commandString,
                        exitCode: 0, // exec sets this to 0 for successful commands
                        stdout: this._sanitizeOutput(stdout),
                        stderr: this._sanitizeOutput(stderr),
                        executionTime,
                        duration: executionTime
                    });
                }
            });

            // Add timeout handling
            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                    resolve(this._createTimeoutResult(commandString, startTime));
                }
            }, this.timeout);
        });
    }

    /**
     * Create a safe error object that redacts sensitive information
     * @private
     */
    _createSafeError(error, executionTime) {
        return {
            message: error.message ? error.message.replace(/(password|token|key|secret)/gi, '[REDACTED]') : 'Unknown error',
            code: error.code,
            signal: error.signal,
            executionTime
        };
    }

    /**
     * Create a timeout result object
     * @private
     */
    _createTimeoutResult(commandString, startTime) {
        return {
            success: false,
            command: commandString,
            exitCode: null,
            error: {
                message: `Command timed out after ${this.timeout}ms`,
                code: 'ETIMEDOUT',
                executionTime: Date.now() - startTime
            },
            stdout: '',
            stderr: '',
            duration: Date.now() - startTime
        };
    }

    /**
     * Get tool description
     */
    getDescription() {
        return 'Tool for executing system commands in a secure, sandboxed environment with safety restrictions. Only allows predefined safe commands in safe directories.';
    }

    /**
     * Get parameter schema
     */
    getParameterSchema() {
        return {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The command to execute'
                },
                args: {
                    type: 'array',
                    items: {type: 'string'},
                    description: 'Arguments for the command',
                    default: []
                },
                cwd: {
                    type: 'string',
                    description: 'Working directory for command execution (must be in allowed list)'
                },
                env: {
                    type: 'object',
                    description: 'Environment variables to pass to the command',
                    additionalProperties: {type: 'string'}
                }
            },
            required: ['command']
        };
    }

    /**
     * Validate parameters
     */
    validate(params) {
        const validation = super.validate(params);
        const errors = [...(validation.errors || [])];

        if (!params.command) {
            errors.push('Command is required');
        } else {
            try {
                this._validateCommand(params.command, params.args || [], params.cwd, params.env || {});
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (params.args && !Array.isArray(params.args)) {
            errors.push('Args must be an array');
        }

        // Validate working directory
        if (params.cwd) {
            try {
                this._validateWorkingDir(params.cwd);
            } catch (error) {
                errors.push(error.message);
            }
        }

        return {isValid: errors.length === 0, errors};
    }

    /**
     * Get tool capabilities
     */
    getCapabilities() {
        return ['command-execution', 'system-utilities', 'process-control'];
    }

    /**
     * Get tool category
     */
    getCategory() {
        return 'command-execution';
    }

    /**
     * Validate command for safety
     * @private
     */
    _validateCommand(command, args = [], cwd, env = {}) {
        // Check for disallowed commands first (higher priority)
        const normalizedCommand = command.split(/\s+/)[0].toLowerCase();

        if (this.disallowedCommands.has(normalizedCommand)) {
            throw new Error(`Command '${normalizedCommand}' is explicitly disallowed`);
        }

        if (!this.allowedCommands.has(normalizedCommand)) {
            throw new Error(`Command '${normalizedCommand}' is not in the allowed list`);
        }

        // Check working directory if provided
        if (cwd) {
            this._validateWorkingDir(cwd);
        }

        const allArgs = [command, ...args].join(' ');

        // Check for shell injection patterns
        const dangerousPatterns = [
            /[\|;&\`]/,  // Pipes, semicolons, amperands, backticks
            /\$\(/,      // Command substitution
            /`.*`/,      // Backtick command substitution
            />\s*[>&]/,  // Output redirection
            /<\s*[<]/,   // Input redirection
            /[\n\r]/,    // Newlines that might separate commands
            /;/,         // Semicolon command separator
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(allArgs)) {
                throw new Error(`Dangerous pattern detected in command: ${allArgs}`);
            }
        }

        // Validate environment variables for dangerous patterns
        for (const [key, value] of Object.entries(env)) {
            if (typeof value === 'string' && dangerousPatterns.some(p => p.test(value))) {
                throw new Error(`Dangerous pattern detected in environment variable ${key}`);
            }
        }

        // Additional checks for specific commands
        if (['rm', 'rmdir', 'del'].includes(normalizedCommand)) {
            throw new Error(`File deletion commands are not allowed`);
        }

        if (['chmod', 'chown'].includes(normalizedCommand)) {
            throw new Error(`File permission modification commands are not allowed`);
        }
    }

    /**
     * Validate working directory for safety
     * @private
     */
    _validateWorkingDir(dirPath) {
        const resolvedPath = path.resolve(dirPath);

        const isAllowed = Array.from(this.allowedWorkingDirs).some(allowedDir => {
            const resolvedAllowedDir = path.resolve(allowedDir);
            return resolvedPath === resolvedAllowedDir || resolvedPath.startsWith(resolvedAllowedDir + path.sep);
        });

        if (!isAllowed) {
            throw new Error(`Working directory is not in allowed list: ${dirPath}`);
        }

        // Additional safety checks
        if (dirPath.includes('..') || dirPath.includes('../') || dirPath.includes('..\\')) {
            throw new Error(`Invalid directory path: ${dirPath}. Path traversal not allowed.`);
        }

        return true;
    }

    /**
     * Sanitize command output for safety
     * @private
     */
    _sanitizeOutput(output) {
        if (!output) {
            return output;
        }

        // Truncate if too large
        if (output.length > this.maxOutputSize) {
            return `${output.substring(0, this.maxOutputSize)}\n[OUTPUT TRUNCATED]`;
        }

        // Redact potentially sensitive information
        return output
            .replace(/(password|token|key|secret|auth|api)[=:]\s*[^\\s\\n\\r]+/gi, '$1: [REDACTED]')
            .replace(/\/\/[^:]+:[^@]+@/g, '//[USER]:[PASS]@'); // Redact HTTP basic auth
    }
}