import type {SessionMessage} from './ConversationSession.js';

export interface HistoryMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function formatHistoryAsMessages(
    history: SessionMessage[],
    limit: number,
): HistoryMessage[] {
    return history.slice(-limit).map(m => ({role: m.role, content: m.content}));
}

export function truncateForBudget(
    messages: HistoryMessage[],
    maxTokens: number,
): HistoryMessage[] {
    const maxChars = Math.max(0, maxTokens) * 4;
    let total = 0;
    const out: HistoryMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (total + m.content.length > maxChars) break;
        out.unshift(m);
        total += m.content.length;
    }
    return out;
}
