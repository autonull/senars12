import type {Schema, Tool, ToolContext, ToolResult} from './types';

export class TimerTool implements Tool {
    readonly name = 'timer';
    readonly description = 'Schedule delayed or recurring actions';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform: start, stop, cancel',
                enum: ['start', 'stop', 'cancel', 'list']
            },
            name: {type: 'string', description: 'Timer name'},
            delay: {type: 'number', description: 'Delay in milliseconds', minimum: 0},
            repeat: {type: 'number', description: 'Number of repetitions (0 for infinite)', minimum: 0},
            callback: {type: 'string', description: 'Callback identifier or action to execute'}
        },
        required: ['action']
    };

    private timers: Map<string, NodeJS.Timeout> = new Map();
    private timerConfig: Map<string, { delay: number; repeat: number; callback: string; count: number }> = new Map();

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {action, name, delay = 1000, repeat = 0, callback} = args as {
            action: 'start' | 'stop' | 'cancel' | 'list';
            name?: string;
            delay?: number;
            repeat?: number;
            callback?: string;
        };

        try {
            switch (action) {
                case 'start':
                    if (!name || !callback) {
                        return {success: false, content: null, error: 'Timer name and callback required'};
                    }
                    return this.startTimer(name, delay, repeat, callback);

                case 'stop':
                    if (!name) {
                        return {success: false, content: null, error: 'Timer name required'};
                    }
                    return this.stopTimer(name);

                case 'cancel':
                    if (!name) {
                        return {success: false, content: null, error: 'Timer name required'};
                    }
                    return this.cancelTimer(name);

                case 'list':
                    return this.listTimers();

                default:
                    return {success: false, content: null, error: `Unknown action: ${action}`};
            }
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Timer operation failed'
            };
        }
    }

    private startTimer(name: string, delay: number, repeat: number, callback: string): ToolResult {
        if (this.timers.has(name)) {
            this.clearTimer(name);
        }

        const config = {delay, repeat, callback, count: 0};
        this.timerConfig.set(name, config);

        let timeout: NodeJS.Timeout;

        const executeCallback = () => {
            config.count++;

            if (repeat > 0 && config.count >= repeat) {
                this.timerConfig.delete(name);
                return;
            }

            if (repeat === 0 || config.count < repeat) {
                timeout = setTimeout(executeCallback, delay);
                this.timers.set(name, timeout);
            }
        };

        timeout = setTimeout(executeCallback, delay);
        this.timers.set(name, timeout);

        return {
            success: true,
            content: {
                name,
                delay,
                repeat,
                callback,
                status: 'started'
            },
            metadata: {timerId: name}
        };
    }

    private stopTimer(name: string): ToolResult {
        const config = this.timerConfig.get(name);
        if (!config) {
            return {success: false, content: null, error: `Timer '${name}' not found`};
        }

        this.clearTimer(name);
        this.timerConfig.delete(name);

        return {
            success: true,
            content: {name, status: 'stopped'}
        };
    }

    private cancelTimer(name: string): ToolResult {
        return this.stopTimer(name);
    }

    private listTimers(): ToolResult {
        const timers: unknown[] = [];
        for (const [name, config] of this.timerConfig.entries()) {
            timers.push({
                name,
                ...config,
                remaining: config.repeat - config.count
            });
        }

        return {
            success: true,
            content: {
                count: timers.length,
                timers
            }
        };
    }

    private clearTimer(name: string): void {
        const timeout = this.timers.get(name);
        if (timeout) {
            clearTimeout(timeout);
            this.timers.delete(name);
        }
    }
}
