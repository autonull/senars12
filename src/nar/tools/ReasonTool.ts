import type {Schema, Tool, ToolContext, ToolResult} from './types';
import {errorResult} from './types';
import type {NAR} from '../nar';
import {termParser, Truth} from '../terms';
import {tool} from './decorator.js';

@tool({
    name: 'reason',
    description: 'Invoke NAR reasoning on a specific term or statement',
    capabilities: {pure: false, readOnly: false}
})
export class ReasonTool implements Tool {
    readonly name = 'reason';
    readonly description = 'Invoke NAR reasoning on a specific term or statement';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            statement: {type: 'string', description: 'Narsese statement to reason about'},
            type: {
                type: 'string',
                description: 'Type of task: belief, goal, or question',
                enum: ['belief', 'goal', 'question']
            },
            truth: {type: 'object', description: 'Truth value for belief/goal'},
            priority: {type: 'number', description: 'Task priority (0-1)', minimum: 0, maximum: 1}
        },
        required: ['statement']
    };

    constructor(private nar: NAR) {
    }

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {statement, type = 'belief', truth, priority = 0.5} = args as {
            statement: string;
            type?: 'belief' | 'goal' | 'question';
            truth?: { frequency?: number; confidence?: number };
            priority?: number;
        };

        try {
            const term = termParser.parse(statement);
            const truthValue = truth ? Truth.create(truth.frequency ?? 0.5, truth.confidence ?? 0.9) : Truth.NEUTRAL; // system boundary — external input may lack truth

            await this.nar.input(statement, type, truthValue);

            return {
                success: true,
                content: {
                    statement,
                    type,
                    term: term.toString(),
                    truth: {
                        f: truthValue.f,
                        c: truthValue.c
                    },
                    priority
                },
                metadata: {timestamp: Date.now()}
            };
        } catch (error) {
            return errorResult(error);
        }
    }
}
