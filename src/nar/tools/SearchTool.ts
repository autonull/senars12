import type { Tool, ToolResult, Schema, ToolContext } from './types';
import type { Memory } from '../memory';
import type { Concept } from '../memory/concept';

export class SearchTool implements Tool {
readonly name = 'search';
readonly description = 'Search memory for concepts matching a term pattern';
readonly parameters: Schema = {
type: 'object',
properties: {
pattern: { type: 'string', description: 'Term pattern to search for' },
limit: { type: 'number', description: 'Maximum number of results', minimum: 1, maximum: 1000 }
},
required: ['pattern']
};

constructor(private memory: Memory) {}

async execute(args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
const { pattern, limit = 100 } = args as { pattern: string; limit?: number };

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
metadata: { totalFound: concepts.length }
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
const results: Concept[] = [];
const patternLower = pattern.toLowerCase();
const conceptMap = (this.memory as any).concepts as Map<string, Concept>;

if (!conceptMap) return results;

for (const concept of conceptMap.values()) {
if (results.length >= limit) break;

const termStr = concept.term.toString();
if (termStr.toLowerCase().includes(patternLower)) {
results.push(concept);
}
}

return results.sort((a, b) => b.priority - a.priority);
}
}
