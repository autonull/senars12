import {OutputFormatter, type CLIOptions} from './OutputFormatter.js';
import {WorkingMemory} from '../nar/memory/WorkingMemory.js';

export interface PipeOutputConfig {
    options?: CLIOptions;
    workingMemory?: WorkingMemory;
    turnCounter?: {increment: () => number};
}

interface TurnMetadata {
    turn: number;
    type: string;
    input: string;
    beliefs?: number;
    tasks?: number;
    derivations?: number;
    lm?: string;
}

export class PipeOutput {
    private readonly formatter: OutputFormatter;
    private readonly config: PipeOutputConfig;
    private turnCount = 0;

constructor(config: PipeOutputConfig = {}) {
this.formatter = new OutputFormatter('pipe', config.options ?? {});
this.config = config;
}

    formatInput(text: string): string {
        const formatted = this.formatter.formatInput(text);
        return formatted;
    }

formatResponse(text: string): string {
if (this.formatter.shouldOutputJson()) {
return this.formatter.formatMetadata({response: text});
}
return this.formatter.formatResponse(text);
}

    formatBeliefResult(input: string, derived: number): string {
        const turn = ++this.turnCount;
        const meta: TurnMetadata = {
            turn,
            type: 'belief',
            input,
            derivations: derived,
        };
        return this.formatMeta(meta) + `\n< Added: ${input}${derived > 0 ? ` (derived ${derived})` : ''}`;
    }

    formatQuestionResult(input: string, derived: number): string {
        const turn = ++this.turnCount;
        const meta: TurnMetadata = {
            turn,
            type: 'question',
            input,
            derivations: derived,
        };
        return this.formatMeta(meta) + `\n< ${derived > 0 ? `Derived ${derived} belief(s)` : 'No derivation found'}`;
    }

    formatCommandResult(input: string, result: string): string {
        const turn = ++this.turnCount;
        const meta: TurnMetadata = {
            turn,
            type: 'command',
            input,
        };
        return this.formatMeta(meta) + `\n< ${result}`;
    }

    formatChatResult(input: string, response: string, lmAvailable: boolean): string {
        const turn = ++this.turnCount;
        const meta: TurnMetadata = {
            turn,
            type: 'chat',
            input,
            lm: lmAvailable ? 'available' : 'unavailable',
        };
        return this.formatMeta(meta) + `\n< ${response}`;
    }

    formatStats(stats: {beliefs: number; tasks: number; concepts: number}): string {
        return `< Beliefs: ${stats.beliefs}, Tasks: ${stats.tasks}, Concepts: ${stats.concepts}`;
    }

    formatError(text: string): string {
        return this.formatter.formatError(text);
    }

    formatQuit(): string {
        return '< Goodbye.';
    }

    formatInit(): string {
        if (this.config.options?.noInit) return '';
        return '< SeNARS ready. Type .help for commands.';
    }

    formatMeta(meta: TurnMetadata): string {
        if (!this.formatter.shouldOutputJson()) return '';
        return this.formatter.formatMetadata(meta as unknown as Record<string, unknown>);
    }

    formatWorkingMemoryOutput(key: string, value: string | null): string {
        if (value === null) return `< Key "${key}" not found in working memory`;
        return `< ${key}: ${value}`;
    }

    formatPinResult(key: string, value: string): string {
        return `< Pinned ${key} = ${value}`;
    }

    formatUnpinResult(key?: string): string {
        return `< ${key ? `Unpinned ${key}` : 'Working memory cleared'}`;
    }

    formatRecallAll(entries: Map<string, string>): string {
        if (entries.size === 0) return '< Working memory is empty';
        const lines = Array.from(entries.entries()).map(([k, v]) => `< ${k}: ${v}`);
        return lines.join('\n');
    }

    incrementTurn(): number {
        this.turnCount++;
        return this.turnCount;
    }

    getTurnCount(): number {
        return this.turnCount;
    }

    resetTurnCount(): void {
        this.turnCount = 0;
    }
}