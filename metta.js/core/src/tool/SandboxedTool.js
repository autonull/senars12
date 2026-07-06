import {BaseTool} from './BaseTool.js';
import {spawn} from 'child_process';
import path from 'path';
import os from 'os';

export const ResourceLimits = {
    MEMORY: 100 * 1024 * 1024,
    CPU_TIME: 5000,
    RUNTIME: 10000,
    STDOUT_SIZE: 1024 * 100,
    STDERR_SIZE: 1024 * 10,
};

export class SandboxedTool extends BaseTool {
    constructor(config = {}) {
        super(config);

        this.memoryLimit = config.memoryLimit || ResourceLimits.MEMORY;
        this.cpuTimeLimit = config.cpuTimeLimit || ResourceLimits.CPU_TIME;
        this.runtimeLimit = config.runtimeLimit || ResourceLimits.RUNTIME;
        this.stdoutSizeLimit = config.stdoutSizeLimit || ResourceLimits.STDOUT_SIZE;
        this.stderrSizeLimit = config.stderrSizeLimit || ResourceLimits.STDERR_SIZE;
        this.workingDir = config.workingDir || os.tmpdir();
        this.allowedPaths = new Set(config.allowedPaths || [
            os.tmpdir(),
            path.join(process.cwd(), 'temp'),
            path.join(process.cwd(), 'work')
        ]);

        this.executionDir = path.join(this.workingDir, 'sandboxes', this.constructor.name, Date.now().toString());

        this._ensureExecutionDirectory();
    }

    async execute(params, context) {
        if (!context?.engine?.capabilityManager) {
            throw new Error('SandboxedTool requires an engine with capability manager');
        }

        const hasCapabilities = await context.engine.capabilityManager.hasAllCapabilities(
            this.constructor.name.toLowerCase().replace(/tool$/, ''),
            this.getRequiredCapabilities()
        );

        if (!hasCapabilities) {
            const requiredCaps = this.getRequiredCapabilities();
            throw new Error(`Tool lacks required capabilities: ${requiredCaps.join(', ')}`);
        }

        const validation = this.validate(params);
        if (!validation.isValid) {
            throw new Error(`Tool parameters validation failed: ${validation.errors.join(', ')}`);
        }

        return this._executeInSandbox(params, context);
    }

    async _executeInSandbox(params, context) {
        throw new Error('_executeInSandbox must be implemented by subclass');
    }

    getRequiredCapabilities() {
        return ['sandbox-execution'];
    }

    getResourceLimits() {
        return {
            memory: this.memoryLimit,
            cpuTime: this.cpuTimeLimit,
            runtime: this.runtimeLimit,
            stdoutSize: this.stdoutSizeLimit,
            stderrSize: this.stderrSizeLimit
        };
    }

    isPathAllowed(targetPath) {
        const resolvedPath = path.resolve(targetPath);

        for (const allowedDir of this.allowedPaths) {
            const resolvedAllowedDir = path.resolve(allowedDir);
            if (resolvedPath === resolvedAllowedDir || resolvedPath.startsWith(resolvedAllowedDir + path.sep)) {
                return true;
            }
        }

        return false;
    }

    _ensureExecutionDirectory() {
    }

    sanitizeOutput(output) {
        if (!output) {
            return output;
        }

        return output
            .replace(/(password|token|key|secret|auth|api)[=:]\s*[^\\s\\n\\r]+/gi, '$1: [REDACTED]')
            .replace(/\/\/[^:]+:[^@]+@/g, '//[USER]:[PASS]@');
    }

    async executeRestrictedCommand(command, args = [], options = {}) {
        const startTime = Date.now();

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let stdoutSize = 0;
            let stderrSize = 0;

            const timeout = Math.min(this.runtimeLimit, options.timeout || this.runtimeLimit);

            const child = spawn(command, args, {
                cwd: this.workingDir,
                timeout: timeout,
                maxBuffer: Math.max(this.stdoutSizeLimit, this.stderrSizeLimit),
                env: this._getSandboxEnv(options.env),
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.on('data', (data) => {
                stdoutSize += data.length;
                if (stdoutSize > this.stdoutSizeLimit) {
                    child.kill();
                    resolve(this._createOutputLimitError('STDOUT', this.stdoutSizeLimit));
                    return;
                }
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderrSize += data.length;
                if (stderrSize > this.stderrSizeLimit) {
                    child.kill();
                    resolve(this._createOutputLimitError('STDERR', this.stderrSizeLimit));
                    return;
                }
                stderr += data.toString();
            });

            child.on('error', (error) => {
                resolve({
                    success: false,
                    exitCode: null,
                    error: {message: `Command execution failed: ${error.message}`},
                    stdout: this.sanitizeOutput(stdout),
                    stderr: this.sanitizeOutput(stderr),
                    executionTime: Date.now() - startTime
                });
            });

            child.on('close', (code, signal) => {
                const executionTime = Date.now() - startTime;

                if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                    resolve({
                        success: false,
                        exitCode: null,
                        error: {
                            message: `Command killed after ${executionTime}ms`,
                            signal: signal,
                            executionTime
                        },
                        stdout: this.sanitizeOutput(stdout),
                        stderr: this.sanitizeOutput(stderr),
                        executionTime
                    });
                    return;
                }

                resolve({
                    success: code === 0,
                    exitCode: code,
                    stdout: this.sanitizeOutput(stdout),
                    stderr: this.sanitizeOutput(stderr),
                    executionTime
                });
            });

            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                    resolve({
                        success: false,
                        exitCode: null,
                        error: {
                            message: `Command timed out after ${timeout}ms`,
                            code: 'ETIMEOUT',
                            executionTime: Date.now() - startTime
                        },
                        stdout: this.sanitizeOutput(stdout),
                        stderr: this.sanitizeOutput(stderr),
                        executionTime: Date.now() - startTime
                    });
                }
            }, timeout);
        });
    }

    /**
     * Create a standard error for output size limits
     * @private
     */
    _createOutputLimitError(outputType, limit) {
        return {
            success: false,
            exitCode: null,
            error: {message: `${outputType} exceeded size limit of ${limit} bytes`},
            stdout: '',
            stderr: '',
            executionTime: Date.now() - (Date.now() - this.runtimeLimit) // Approximate execution time
        };
    }

    _getSandboxEnv(additionalEnv = {}) {
        const safeEnv = {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            TEMP: os.tmpdir(),
            TMPDIR: os.tmpdir(),
            LANG: process.env.LANG || 'C.UTF-8',
            LC_ALL: process.env.LC_ALL || 'C.UTF-8'
        };

        return {...safeEnv, ...additionalEnv};
    }

    async cleanup() {
    }
}