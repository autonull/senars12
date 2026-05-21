import type {NAR} from '../nar/nar.js';

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

const EXPLICIT_PATTERN = /\[(BELIEVE|TOOL|QUESTION|GOAL):\s*([^\]]+)\]/gi;

export class ResponseInterpreter {
    private readonly nar: NAR;
    private readonly extractionMode: ExtractionMode;

    constructor(nar: NAR, config?: ResponseInterpreterConfig) {
        this.nar = nar;
        this.extractionMode = config?.extractionMode ?? 'explicit';
    }

    interpret(response: string, source?: string): InterpretationResult {
        if (this.extractionMode === 'none') {
            return {actions: [], cleanedResponse: response, hasActions: false};
        }

        const actions: ParsedAction[] = [];
        let cleaned = response;

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

        return {
            actions,
            cleanedResponse: cleaned.trim(),
            hasActions: actions.length > 0,
        };
    }

    async executeAndRespond(result: InterpretationResult): Promise<string> {
        const responses: string[] = [];

        for (const action of result.actions) {
            try {
                if (action.type === 'narsese') {
                    await this.nar.believe(action.raw);
                    responses.push(`Belief added: ${action.raw}`);
                } else if (action.type === 'question') {
                    await this.nar.question(action.raw);
                    responses.push(`Question asked: ${action.raw}`);
                } else if (action.type === 'tool_call') {
                    responses.push(`Tool call recognized: ${action.raw}`);
                }
            } catch {
                responses.push(`Failed to execute: ${action.raw}`);
            }
        }

        if (responses.length > 0) {
            return `${result.cleanedResponse}\n\n(${responses.join('; ')})`;
        }

        return result.cleanedResponse;
    }
}