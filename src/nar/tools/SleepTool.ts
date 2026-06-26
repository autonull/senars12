import type {Schema, Tool, ToolResult} from './types';
import {errorResult} from './types';
import {tool} from './decorator.js';
import {sleep} from '../utils/index.js';

@tool({
    name: 'sleep',
    description: 'Delay execution for specified milliseconds',
    capabilities: {pure: false, readOnly: true}
})
export class SleepTool implements Tool {
    readonly name = 'sleep';
    readonly description = 'Delay execution for specified milliseconds';
    readonly parameters: Schema = {
        type: 'object',
        properties: {duration: {type: 'number', description: 'Duration in milliseconds', minimum: 0, maximum: 60000}},
        required: ['duration']
    };

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {duration} = args as { duration: number };
        try {
            await sleep(duration);
            return {success: true, content: {slept: duration}};
        } catch (error) {
            return errorResult(error);
        }
    }
}