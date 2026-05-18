import {CHANNEL_DEFAULTS, type ChannelType} from './ChannelBehavior.js';

export class ResponseFormatter {
format(channelType: ChannelType, text: string): string | string[] {
const cleaned = channelType === 'irc' ? this.stripMarkdown(text) : text;
const limit = CHANNEL_DEFAULTS[channelType]?.maxResponseLength ?? 8000;
return channelType === 'irc' ? this.chunk(cleaned, limit) : cleaned;
}

formatForIRC(text: string): string[] {
const result = this.format('irc', text);
return Array.isArray(result) ? result : [result];
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

private chunk(text: string, limit: number): string[] {
const chunks: string[] = [];
for (let i = 0; i < text.length; i += limit) {
chunks.push(text.slice(i, i + limit));
}
return chunks;
}
}