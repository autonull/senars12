import type {Schema, Tool, ToolResult} from './types';
import {errorResult} from './types';
import {promises as fs} from 'node:fs';
import {tool} from './decorator.js';

@tool({
    name: 'readFile',
    description: 'Read contents of a file',
    capabilities: {pure: false, readOnly: true}
})
export class ReadFileTool implements Tool {
    readonly name = 'readFile';
    readonly description = 'Read contents of a file';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            path: {type: 'string', description: 'File path to read'}
        },
        required: ['path']
    };

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {path} = args as { path: string };

        try {
            const content = await fs.readFile(path, 'utf-8');
            return {success: true, content: {path, content}};
        } catch (error) {
            return errorResult(error);
        }
    }
}

@tool({
    name: 'writeFile',
    description: 'Write content to a file',
    capabilities: {pure: false, readOnly: false}
})
export class WriteFileTool implements Tool {
    readonly name = 'writeFile';
    readonly description = 'Write content to a file';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            path: {type: 'string', description: 'File path to write'},
            content: {type: 'string', description: 'Content to write'}
        },
        required: ['path', 'content']
    };

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {path, content} = args as { path: string; content: string };

        try {
            await fs.writeFile(path, content, 'utf-8');
            return {success: true, content: {path, written: content.length}};
        } catch (error) {
            return errorResult(error);
        }
    }
}
