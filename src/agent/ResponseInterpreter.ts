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

type ActionHandler = (action: ParsedAction, nar: NAR) => Promise<string>;

export class ResponseInterpreter {
    private readonly nar: NAR;
    private readonly handlers: Map<string, ActionHandler> = new Map();

    constructor(nar: NAR) {
        this.nar = nar;
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

    interpret(response: string): InterpretationResult {
        const actions: ParsedAction[] = [];
        let cleaned = response;

        const narsesePattern = /\(([^)]+)\s*(-->|<->|=>|<=>|[&|])\s*([^)]+)\)/g;
        let match;
        while ((match = narsesePattern.exec(response)) !== null) {
            actions.push({type: 'narsese', raw: match[0]});
        }

        const toolCallPattern = /\b(calculate|search|http|read|write|reason|explain|learn|timer|process)\s*\([^)]*\)/gi;
        while ((match = toolCallPattern.exec(response)) !== null) {
            actions.push({type: 'tool_call', raw: match[0]});
        }

        const questionPattern = /\?[^.?\n]+$/gm;
        const questionMatches = response.match(questionPattern) || [];
        for (const q of questionMatches) {
            const trimmed = q.trim();
            if (trimmed.length > 3 && !trimmed.startsWith('http')) {
                actions.push({type: 'question', raw: trimmed});
            }
        }

        return {
            actions,
            cleanedResponse: cleaned,
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