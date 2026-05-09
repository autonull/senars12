import type {Schema, Tool, ToolResult} from './types';
import {promises as fs} from 'fs';

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
            return {
                success: true,
                content: {path, content}
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Failed to read file'
            };
        }
    }
}

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
            return {
                success: true,
                content: {path, written: content.length}
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Failed to write file'
            };
        }
    }
}
