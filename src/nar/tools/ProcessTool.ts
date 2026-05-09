import type {Schema, Tool, ToolContext, ToolResult} from './types';
import {spawn, type SpawnOptions} from 'child_process';

export class ProcessTool implements Tool {
    readonly name = 'process';
    readonly description = 'Spawn and manage subprocesses';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            command: {type: 'string', description: 'Command to execute'},
            args: {type: 'array', description: 'Command arguments', items: {type: 'string'}},
            cwd: {type: 'string', description: 'Working directory'},
            timeout: {type: 'number', description: 'Timeout in milliseconds', minimum: 0, maximum: 300000},
            action: {type: 'string', description: 'Action: run, kill, list', enum: ['run', 'kill', 'list']},
            processId: {type: 'number', description: 'Process ID for kill action'}
        },
        required: []
    };

    private processes: Map<number, { process: any; command: string; startTime: number }> = new Map();

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {action = 'run', command, args: cmdArgs = [], cwd, timeout = 30000, processId} = args as {
            action?: 'run' | 'kill' | 'list';
            command?: string;
            args?: string[];
            cwd?: string;
            timeout?: number;
            processId?: number;
        };

        try {
            if (action === 'list') {
                return this.listProcesses();
            }

            if (action === 'kill') {
                if (!processId) {
                    return {success: false, content: null, error: 'Process ID required for kill action'};
                }
                return this.killProcess(processId);
            }

            if (action === 'run' && command) {
                return this.runProcess(command, cmdArgs, cwd || process.cwd(), timeout);
            }

            return {success: false, content: null, error: 'Invalid action or missing command'};
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Process operation failed'
            };
        }
    }

    private async runProcess(command: string, args: string[], cwd: string, timeout: number): Promise<ToolResult> {
        const options: SpawnOptions = {cwd, shell: true};

        const proc = spawn(command, args, options);
        const pid = proc.pid!;
        const startTime = Date.now();

        const stdout: string[] = [];
        const stderr: string[] = [];

        proc.stdout?.on('data', data => {
            stdout.push(data.toString());
        });

        proc.stderr?.on('data', data => {
            stderr.push(data.toString());
        });

        this.processes.set(pid, {
            process: proc,
            command: `${command} ${args.join(' ')}`,
            startTime
        });

        const timeoutId = setTimeout(() => {
            proc.kill();
        }, timeout);

        return new Promise((resolve) => {
            proc.on('close', (code) => {
                clearTimeout(timeoutId);
                this.processes.delete(pid);

                resolve({
                    success: code === 0,
                    content: {
                        pid,
                        command: `${command} ${args.join(' ')}`,
                        exitCode: code,
                        stdout: stdout.join(''),
                        stderr: stderr.join(''),
                        duration: Date.now() - startTime
                    },
                    metadata: {
                        exitCode: code,
                        duration: Date.now() - startTime
                    }
                });
            });

            proc.on('error', (error) => {
                clearTimeout(timeoutId);
                this.processes.delete(pid);

                resolve({
                    success: false,
                    content: null,
                    error: error.message
                });
            });
        });
    }

    private killProcess(pid: number): ToolResult {
        const procInfo = this.processes.get(pid);
        if (!procInfo) {
            return {success: false, content: null, error: `Process ${pid} not found`};
        }

        try {
            procInfo.process.kill();
            this.processes.delete(pid);

            return {
                success: true,
                content: {
                    pid,
                    command: procInfo.command,
                    status: 'killed'
                }
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Failed to kill process'
            };
        }
    }

    private listProcesses(): ToolResult {
        const processes: unknown[] = [];
        for (const [pid, info] of this.processes.entries()) {
            processes.push({
                pid,
                command: info.command,
                startTime: info.startTime,
                duration: Date.now() - info.startTime
            });
        }

        return {
            success: true,
            content: {
                count: processes.length,
                processes
            }
        };
    }
}
