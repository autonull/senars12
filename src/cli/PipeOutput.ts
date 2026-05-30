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

    formatInput = (text: string): string => this.formatter.formatInput(text);

    formatResponse = (text: string): string =>
        this.formatter.shouldOutputJson() ? this.formatter.formatMetadata({response: text}) : this.formatter.formatResponse(text);

    formatBeliefResult = (input: string, derived: number): string =>
        this.formatMeta({turn: ++this.turnCount, type: 'belief', input, derivations: derived}) +
        `\n< Added: ${input}${derived > 0 ? ` (derived ${derived})` : ''}`;

    formatQuestionResult = (input: string, derived: number): string =>
        this.formatMeta({turn: ++this.turnCount, type: 'question', input, derivations: derived}) +
        `\n< ${derived > 0 ? `Derived ${derived} belief(s)` : 'No derivation found'}`;

    formatCommandResult = (input: string, result: string): string =>
        this.formatMeta({turn: ++this.turnCount, type: 'command', input}) + `\n< ${result}`;

    formatChatResult = (input: string, response: string, lmAvailable: boolean): string =>
        this.formatMeta({turn: ++this.turnCount, type: 'chat', input, lm: lmAvailable ? 'available' : 'unavailable'}) +
        `\n< ${response}`;

    formatStats = (stats: {beliefs: number; tasks: number; concepts: number}): string =>
        `< Beliefs: ${stats.beliefs}, Tasks: ${stats.tasks}, Concepts: ${stats.concepts}`;

    formatError = (text: string): string => this.formatter.formatError(text);

    formatQuit = (): string => '< Goodbye.';

    formatInit = (): string => this.config.options?.noInit ? '' : '< SeNARS ready. Type .help for commands.';

    formatMeta = (meta: TurnMetadata): string =>
        this.formatter.shouldOutputJson() ? this.formatter.formatMetadata(meta as unknown as Record<string, unknown>) : '';

    formatWorkingMemoryOutput = (key: string, value: string | null): string =>
        value === null ? `< Key "${key}" not found in working memory` : `< ${key}: ${value}`;

    formatPinResult = (key: string, value: string): string => `< Pinned ${key} = ${value}`;

    formatUnpinResult = (key?: string): string => `< ${key ? `Unpinned ${key}` : 'Working memory cleared'}`;

    formatRecallAll = (entries: Map<string, string>): string =>
        entries.size === 0 ? '< Working memory is empty' : Array.from(entries.entries()).map(([k, v]) => `< ${k}: ${v}`).join('\n');

    incrementTurn = (): number => ++this.turnCount;

    getTurnCount = (): number => this.turnCount;

    resetTurnCount = (): void => { this.turnCount = 0; };
}