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

    formatInput(text: string): string {
        if (this.options.quiet) return '';
        return `> ${text}`;
    }

    formatResponse(text: string): string {
        return `< ${text}`;
    }

    formatError(text: string): string {
        return `! ${text}`;
    }

    formatMetadata(data: Record<string, unknown>): string {
        return `# ${JSON.stringify(data)}`;
    }

    formatForChannel(text: string): string | string[] {
        if (this.channelType === 'irc') {
            return this.chunkText(text, 400);
        }
        return text;
    }

    private chunkText(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        const stripped = this.stripAnsi(text);
        for (let i = 0; i < stripped.length; i += maxLength) {
            chunks.push(stripped.slice(i, i + maxLength));
        }
        return chunks;
    }

    private stripAnsi(text: string): string {
        return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    }

    shouldOutputJson(): boolean {
        return this.options.json ?? false;
    }

    shouldEchoInput(): boolean {
        return !this.options.quiet;
    }
}