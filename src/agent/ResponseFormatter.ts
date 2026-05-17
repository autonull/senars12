import type {ChannelBehavior} from './BotProfile.js';

export class ResponseFormatter {
    private readonly behavior: ChannelBehavior;

    constructor(behavior: ChannelBehavior) {
        this.behavior = behavior;
    }

    formatForIRC(text: string): string[] {
        const stripped = this.stripMarkdown(text);
        const chunks: string[] = [];
        for (let i = 0; i < stripped.length; i += this.behavior.maxResponseLength) {
            chunks.push(stripped.slice(i, i + this.behavior.maxResponseLength));
        }
        return chunks;
    }

    formatForWS(text: string): string {
        return text;
    }

    formatForCLI(text: string): string {
        return text;
    }

    addProvenance(response: string, _beliefs: Array<{term: string; truth: {f: number; c: number}}>): string {
        return response;
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1');
    }
}