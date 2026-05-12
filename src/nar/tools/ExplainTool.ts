import type {Schema, Tool, ToolContext, ToolResult} from './types';
import type {Concept, Memory} from '../memory';
import {termParser} from '../terms';

export class ExplainTool implements Tool {
    readonly name = 'explain';
    readonly description = 'Generate human-readable explanation for a belief or derivation';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            term: {type: 'string', description: 'Term or concept to explain'},
            includeDerivations: {type: 'boolean', description: 'Include derivation history'},
            includeEvidence: {type: 'boolean', description: 'Include supporting/conflicting evidence'}
        },
        required: ['term']
    };

    constructor(private memory: Memory) {
    }

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {term: termStr, includeDerivations = true, includeEvidence = true} = args as {
            term: string;
            includeDerivations?: boolean;
            includeEvidence?: boolean;
        };

        try {
            const _term = termParser.parse(termStr);
            const concept = this.findConcept(termStr);

            if (!concept) {
                return {
                    success: false,
                    content: null,
                    error: `Concept '${termStr}' not found in memory`
                };
            }

            const explanation = this.generateExplanation(concept, includeDerivations, includeEvidence);

            return {
                success: true,
                content: explanation,
                metadata: {
                    term: concept.term.toString(),
                    priority: concept.priority
                }
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Explanation generation failed'
            };
        }
    }

    private findConcept(termStr: string): Concept | undefined {
        const conceptMap = (this.memory as any).concepts as Map<string, Concept>;
        if (!conceptMap) return undefined;
        for (const concept of conceptMap.values()) {
            const termStr2 = concept.term.toString();
            if (termStr2 === termStr || termStr2.includes(termStr)) return concept;
        }
        return undefined;
    }

    private generateExplanation(concept: Concept, includeDerivations: boolean, includeEvidence: boolean): Record<string, unknown> {
        const explanation: Record<string, unknown> = {
            term: concept.term.toString(),
            priority: concept.priority,
            totalTasks: concept.totalTasks,
            summary: this.generateSummary(concept)
        };

        if (includeDerivations) {
            explanation.derivations = this.getDerivationInfo(concept);
        }

        if (includeEvidence) {
            explanation.evidence = this.getEvidence(concept);
        }

        return explanation;
    }

    private generateSummary(concept: Concept): string {
        const priority = concept.priority;

        let summary = `The concept "${concept.term.toString()}" has priority ${priority.toFixed(2)}`;

        if (priority > 0.8) {
            summary += ' (high priority)';
        } else if (priority > 0.5) {
            summary += ' (moderate priority)';
        } else {
            summary += ' (low priority)';
        }

        return summary + '.';
    }

    private getDerivationInfo(_concept: Concept): unknown {
        return {
            status: 'derivations not tracked at concept level'
        };
    }

    private getEvidence(_concept: Concept): { supporting: unknown[]; conflicting: unknown[] } {
        return {
            supporting: [],
            conflicting: []
        };
    }
}
