import type {Schema, Tool, ToolContext, ToolResult} from './types';
import {errorResult} from './types';
import type {Memory} from '../memory';
import {termParser, Truth} from '../terms';
import {createBudget} from '../types';

export class LearnTool implements Tool {
    readonly name = 'learn';
    readonly description = 'Add new knowledge from external sources';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            knowledge: {type: 'string', description: 'Narsese statement to learn'},
            type: {
                type: 'string',
                description: 'Type of knowledge: belief, goal, or fact',
                enum: ['belief', 'goal', 'fact']
            },
            truth: {type: 'object', description: 'Truth value (frequency and confidence)'},
            source: {type: 'string', description: 'Source of the knowledge'},
            priority: {type: 'number', description: 'Priority level (0-1)', minimum: 0, maximum: 1}
        },
        required: ['knowledge']
    };

    constructor(private memory: Memory) {
    }

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {knowledge, type = 'belief', truth, source = 'external', priority = 0.5} = args as {
            knowledge: string;
            type?: 'belief' | 'goal' | 'fact';
            truth?: { frequency?: number; confidence?: number };
            source?: string;
            priority?: number;
        };

        try {
            const term = termParser.parse(knowledge);
            const truthValue = truth ? Truth.create(truth.frequency ?? 0.5, truth.confidence ?? 0.9) : Truth.NEUTRAL;
            const budget = createBudget(priority);

            this.memory.addTask(term, 'belief' as any, truthValue, budget);

            const concept = this.memory.getConcept(term);

            return {
                success: true,
                content: {
                    learned: knowledge,
                    type,
                    source,
                    term: concept?.term.toString() || knowledge,
                    priority: concept?.priority || priority
                },
                metadata: {
                    source,
                    timestamp: Date.now(),
                    priority
                }
            };
        } catch (error) {
            return errorResult(error);
        }
    }
}
