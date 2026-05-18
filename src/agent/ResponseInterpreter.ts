import type {NAR} from '../nar/nar.js';
import {LMResponseParser} from '../nar/lm/parser.js';

export interface ParsedAction {
    type: 'narsese' | 'tool_call' | 'question';
    raw: string;
    parsed?: unknown;
}

export interface InterpretationResult {
    actions: ParsedAction[];
    cleanedResponse: string;
    hasActions: boolean;
}

export type ExtractionMode = 'none' | 'explicit' | 'narsese' | 'all';

export interface ResponseInterpreterConfig {
    extractionMode?: ExtractionMode;
    trustedSources?: string[];
    directivePatterns?: RegExp[];
}

type ActionHandler = (action: ParsedAction, nar: NAR) => Promise<string>;

const EXPLICIT_PATTERN = /\[(BELIEVE|TOOL|QUESTION|GOAL):\s*([^\]]+)\]/gi;
const EXPLICIT_NARSESE_PATTERN = /\[BELIEVE:\s*((?:\([^\)]+\)[^.]*\.)+)\]/gi;

export class ResponseInterpreter {
    private readonly nar: NAR;
    private readonly handlers: Map<string, ActionHandler> = new Map();
    private readonly extractionMode: ExtractionMode;
    private readonly trustedSources: Set<string>;
    private readonly directivePatterns: RegExp[];

    constructor(nar: NAR, config?: ResponseInterpreterConfig) {
        this.nar = nar;
        this.extractionMode = config?.extractionMode ?? 'explicit';
        this.trustedSources = new Set(config?.trustedSources ?? []);
        this.directivePatterns = config?.directivePatterns ?? [];
        this.registerDefaultHandlers();
    }

    private registerDefaultHandlers(): void {
        this.registerHandler('narsese', async (action) => {
            const parsed = LMResponseParser.parse(action.raw);
            if (parsed.valid && parsed.term) {
                await this.nar.believe(parsed.term.toString());
                return `Belief added: ${action.raw}`;
            }
            return `Could not parse: ${action.raw}`;
        });

        this.registerHandler('tool_call', async (action) => {
            return `Tool call recognized: ${action.raw}`;
        });

        this.registerHandler('question', async (action) => {
            await this.nar.question(action.raw);
            return `Question asked: ${action.raw}`;
        });
    }

    registerHandler(type: string, handler: ActionHandler): void {
        this.handlers.set(type, handler);
    }

    interpret(response: string, source?: string): InterpretationResult {
        if (this.extractionMode === 'none') {
            return {actions: [], cleanedResponse: response, hasActions: false};
        }

        const actions: ParsedAction[] = [];
        let cleaned = response;

        if (this.extractionMode === 'explicit' || this.extractionMode === 'all') {
            const explicitMatches = response.matchAll(EXPLICIT_PATTERN);
            for (const match of explicitMatches) {
                const directive = match[1]!;
                const content = match[2]!;
                switch (directive.toUpperCase()) {
                    case 'BELIEVE':
                        actions.push({type: 'narsese', raw: content.trim()});
                        cleaned = cleaned.replace(match[0], '');
                        break;
                    case 'TOOL':
                        actions.push({type: 'tool_call', raw: content.trim()});
                        cleaned = cleaned.replace(match[0], '');
                        break;
                    case 'QUESTION':
                        actions.push({type: 'question', raw: content.trim()});
                        cleaned = cleaned.replace(match[0], '');
                        break;
                }
            }
        }

        if (this.extractionMode === 'narsese' || this.extractionMode === 'all') {
            const narsesePattern = /\(([^)]+)\s*(-->|<->|=>|<=>|[&|])\s*([^)]+)\)/g;
            let narseseMatch;
            while ((narseseMatch = narsesePattern.exec(response)) !== null) {
                actions.push({type: 'narsese', raw: narseseMatch[0]});
            }
        }

        if (this.extractionMode === 'all') {
            const toolCallPattern = /\b(calculate|search|http|read|write|reason|explain|learn|timer|process)\s*\([^)]*\)/gi;
            let toolMatch;
            while ((toolMatch = toolCallPattern.exec(response)) !== null) {
                actions.push({type: 'tool_call', raw: toolMatch[0]});
            }

            const questionPattern = /\?[^.?\n]+$/gm;
            const questionMatches = response.match(questionPattern) || [];
            for (const q of questionMatches) {
                const trimmed = q.trim();
                if (trimmed.length > 3 && !trimmed.startsWith('http')) {
                    actions.push({type: 'question', raw: trimmed});
                }
            }
        }

        return {
            actions,
            cleanedResponse: cleaned.trim(),
            hasActions: actions.length > 0,
        };
    }

    async executeAndRespond(result: InterpretationResult): Promise<string> {
        const responses: string[] = [];

        for (const action of result.actions) {
            const handler = this.handlers.get(action.type);
            if (handler) {
                try {
                    const response = await handler(action, this.nar);
                    responses.push(response);
                } catch {
                    responses.push(`Failed to execute: ${action.raw}`);
                }
            }
        }

        if (responses.length > 0) {
            return `${result.cleanedResponse}\n\n(${responses.join('; ')})`;
        }

        return result.cleanedResponse;
    }
}