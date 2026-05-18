import type {NAR} from '../nar/nar.js';
import type {SeNARSRegistry} from '../nar/lm/providers.js';
import {getQualityModel} from '../nar/lm/providers.js';
import {generateText, type ModelMessage} from 'ai';
import {createLogger} from '../nar/logger/index.js';
import {errMsg} from '../nar/utils/helpers.js';
import {tryRepairAndParse} from '../nar/lm/response-repair.js';
import type {SkillCatalog} from './SkillCatalog.js';
import type {LastResults} from './LastResults.js';
import type {DegradationManager} from './DegradationManager.js';

export interface ChatResponderConfig {
    nar: NAR;
    registry?: SeNARSRegistry;
    name?: string;
    personality?: string;
    maxContextConcepts?: number;
    maxResponseTokens?: number;
    skillCatalog?: SkillCatalog;
    lastResults?: LastResults;
    degradationManager?: DegradationManager;
}

export class ChatResponder {
    private readonly nar: NAR;
    private readonly registry?: SeNARSRegistry;
    private readonly name: string;
    private readonly personality: string;
    private readonly maxContextConcepts: number;
    private readonly maxResponseTokens: number;
    private readonly skillCatalog?: SkillCatalog;
    private readonly lastResults?: LastResults;
    private readonly degradationManager?: DegradationManager;
    private readonly logger = createLogger({scope: 'chat:responder'});
    private readonly conversationHistory: ModelMessage[] = [];
    private readonly maxHistoryLength = 10;

    constructor(config: ChatResponderConfig) {
        this.nar = config.nar;
        this.registry = config.registry;
        this.name = config.name ?? 'SeNARS';
        this.personality = config.personality ?? DEFAULT_PERSONALITY;
        this.maxContextConcepts = config.maxContextConcepts ?? 15;
        this.maxResponseTokens = config.maxResponseTokens ?? 512;
        this.skillCatalog = config.skillCatalog;
        this.lastResults = config.lastResults;
        this.degradationManager = config.degradationManager;
    }

    async respond(userMessage: string): Promise<string> {
        if (this.degradationManager?.shouldUseFallback()) {
            return this.degradationManager.getFallbackResponse(userMessage) ?? this.fallbackResponse(userMessage);
        }

        try {
            const model = this.registry ? getQualityModel(this.registry) : this.nar.getQualityModel();
            if (!model) {
                return this.fallbackResponse(userMessage);
            }

            const systemPrompt = this.buildSystemPrompt();
            const messages = this.buildMessages(systemPrompt, userMessage);

            const result = await generateText({
                model,
                messages,
                maxOutputTokens: this.maxResponseTokens,
                temperature: 0.7,
                allowSystemInMessages: true,
            });

            const response = tryRepairAndParse(
                result.text.trim(),
                (r) => r,
                'markdown'
            ) ?? result.text.trim();
            this.addHistory('user', userMessage);
            this.addHistory('assistant', response);

            return response;
        } catch (error) {
            this.logger.warn(`Chat response failed: ${errMsg(error)}`);
            this.degradationManager?.setLMStatus('degraded');
            return this.fallbackResponse(userMessage);
        }
    }

    clearHistory(): void {
        this.conversationHistory.length = 0;
    }

    private buildSystemPrompt(): string {
        const attentionContext = this.getAttentionContext();
        const memoryContext = this.getMemoryContext();
        const skillContext = this.getSkillContext();
        const recentContext = this.getRecentContext();

        return `${SYSTEM_PROMPT_BASE}

## Identity
Name: ${this.name}
${this.personality}

## Knowledge Context (Active Concepts)
${attentionContext}

## Memory Beliefs
${memoryContext}

${skillContext}

${recentContext}

## Response Guidelines
- Be conversational, helpful, and concise
- Draw on your knowledge context when relevant
- Acknowledge uncertainty when appropriate
- Use natural language, not Narsese syntax
- Keep responses under 3-4 sentences unless asked for detail`.trim();
    }

    private getSkillContext(): string {
        if (!this.skillCatalog) return '';
        const skills = this.skillCatalog.getSkillsForPrompt();
        return `## Available Skills\n${skills}`;
    }

    private getRecentContext(): string {
        if (!this.lastResults) return '';
        const recent = this.lastResults.getRecent(3);
        if (!recent) return '';
        return `## Recent Conversation\n${recent}`;
    }

    private getAttentionContext(): string {
        try {
            const report = this.nar.attentionReport();
            if (report.concepts.length === 0) {
                return '(No active concepts yet - learning from conversation)';
            }
            const top = report.concepts.slice(0, this.maxContextConcepts);
            return top.map(c => `- ${c.term} (attention: ${(c.priority * 100).toFixed(0)}%)`).join('\n');
        } catch {
            return '(Attention context unavailable)';
        }
    }

    private getMemoryContext(): string {
        try {
            const beliefs = this.nar.getBeliefs();
            if (beliefs.length === 0) {
                return '(No stored beliefs yet)';
            }
            const top = beliefs.slice(0, this.maxContextConcepts);
            return top.map(b => {
                const t = b.truth;
                return `- ${b.term.toString()} [f=${t.f.toFixed(2)} c=${t.c.toFixed(2)}]`;
            }).join('\n');
        } catch {
            return '(Memory context unavailable)';
        }
    }

    private buildMessages(systemPrompt: string, userMessage: string): ModelMessage[] {
        const messages: ModelMessage[] = [
            {role: 'system', content: systemPrompt},
        ];

        const recentHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        for (const msg of recentHistory) {
            messages.push(msg);
        }

        messages.push({role: 'user', content: userMessage});
        return messages;
    }

    private addHistory(role: 'user' | 'assistant', content: string): void {
        const mappedRole = role === 'assistant' ? 'assistant' : 'user';
        this.conversationHistory.push({role: mappedRole, content});
        while (this.conversationHistory.length > this.maxHistoryLength * 2) {
            this.conversationHistory.shift();
        }
    }

    private fallbackResponse(userMessage: string): string {
        const lower = userMessage.toLowerCase();
        if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
            return `Hello! I'm ${this.name}, a reasoning-based AI assistant. How can I help you?`;
        }
        if (lower.includes('who are you') || lower.includes('what are you')) {
            return `I'm ${this.name}, an AI built on Non-Axiomatic Reasoning (NAR). I learn from our conversations and reason about knowledge using formal logic.`;
        }
        if (lower.includes('thank')) {
            return "You're welcome! Feel free to ask me anything else.";
        }
        return `I'm processing your input: "${userMessage}". I'm learning and building knowledge as we converse. Try telling me a fact (ending with .) or asking a question (ending with ?).`;
    }
}

const DEFAULT_PERSONALITY = `You are SeNARS, an intelligent conversational AI built on Non-Axiomatic Reasoning (NAR).
You are curious, analytical, and helpful. You learn from conversations and reason about knowledge.
You acknowledge what you don't know and express appropriate uncertainty.`;

const SYSTEM_PROMPT_BASE = `You are an intelligent, conversational AI assistant built on Non-Axiomatic Reasoning principles.
You engage in natural dialogue, learn from interactions, and reason about knowledge using formal logic.
You have access to your current knowledge state and attention focus, which reflect what you've learned and what you're currently thinking about.`;
