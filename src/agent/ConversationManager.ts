import {ConversationStateManager} from './ConversationStateManager.js';

export interface ConversationContext {
    userId: string;
    messages: Array<{role: 'user' | 'assistant'; content: string; timestamp: number}>;
    lastIntent?: string;
    topic?: string;
}

export class ConversationManager {
    private readonly perUser: Map<string, ConversationContext> = new Map();
    private readonly maxHistory = 20;
    private readonly stateManager = new ConversationStateManager({} as any);

    getContext(userId: string): ConversationContext {
        if (!this.perUser.has(userId)) {
            this.perUser.set(userId, {userId, messages: []});
        }
        return this.perUser.get(userId)!;
    }

    addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
        const ctx = this.getContext(userId);
        ctx.messages.push({role, content, timestamp: Date.now()});
        if (ctx.messages.length > this.maxHistory) {
            ctx.messages.shift();
        }
    }

    getContextForPrompt(userId: string): string {
        const ctx = this.getContext(userId);
        if (ctx.messages.length === 0) return '';
        return ctx.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    prune(maxAgeMs: number): void {
        const cutoff = Date.now() - maxAgeMs;
        for (const [userId, ctx] of this.perUser) {
            ctx.messages = ctx.messages.filter(m => m.timestamp > cutoff);
            if (ctx.messages.length === 0) {
                this.perUser.delete(userId);
            }
        }
    }

    clearUser(userId: string): void {
        this.perUser.delete(userId);
    }

    size(): number {
        return this.perUser.size;
    }
}