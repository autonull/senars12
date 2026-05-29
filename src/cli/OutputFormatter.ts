import type {ChannelType} from '../agent/ChannelBehavior.js';

export interface OutputFormat {
    prefix: string;
    timestamp?: boolean;
    metadata?: boolean;
}

export interface CLIOptions {
    json?: boolean;
    quiet?: boolean;
    noInit?: boolean;
    timeout?: number;
    maxTurns?: number;
}

export class OutputFormatter {
    private readonly channelType: ChannelType;
    private readonly options: CLIOptions;

    constructor(channelType: ChannelType = 'cli', options: CLIOptions = {}) {
        this.channelType = channelType;
        this.options = options;
    }

    formatInput = (text: string): string => this.options.quiet ? '' : `> ${text}`;

    formatResponse = (text: string): string => `< ${text}`;

    formatError = (text: string): string => `! ${text}`;

    formatMetadata = (data: Record<string, unknown>): string => `# ${JSON.stringify(data)}`;

    formatForChannel = (text: string): string | string[] =>
        this.channelType === 'irc' ? this.chunkText(text, 400) : text;

    private chunkText = (text: string, maxLength: number): string[] => {
        const stripped = this.stripAnsi(text);
        return Array.from({length: Math.ceil(stripped.length / maxLength)}, (_, i) =>
            stripped.slice(i * maxLength, (i + 1) * maxLength)
        );
    };

    private stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    shouldOutputJson = (): boolean => this.options.json ?? false;

    shouldEchoInput = (): boolean => !this.options.quiet;
}