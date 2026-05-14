import type {Schema, Tool, ToolContext, ToolResult} from './types';
import type {Concept, Memory} from '../memory';

export class SearchTool implements Tool {
    readonly name = 'search';
    readonly description = 'Search memory for concepts matching a term pattern';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            pattern: {type: 'string', description: 'Term pattern to search for'},
            limit: {type: 'number', description: 'Maximum number of results', minimum: 1, maximum: 1000}
        },
        required: ['pattern']
    };

    constructor(private memory: Memory) {
    }

    async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
        const {pattern, limit = 100} = args as { pattern: string; limit?: number };

        try {
            const concepts = this.searchMemory(pattern, limit);
            return {
                success: true,
                content: {
                    count: concepts.length,
                    results: concepts.map(c => ({
                        term: c.term.toString(),
                        priority: c.priority,
                        totalTasks: c.totalTasks
                    }))
                },
                metadata: {totalFound: concepts.length}
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Search failed'
            };
        }
    }

    private searchMemory(pattern: string, limit: number): Concept[] {
        return this.memory.findConcepts(pattern, limit);
    }
}
