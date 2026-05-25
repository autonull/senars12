import type {Schema, Tool, ToolResult} from './types';
import {errorResult} from './types';
import {URL} from 'url';
import {tool} from './decorator.js';

@tool({
    name: 'http',
    description: 'Make HTTP requests (sandboxed)',
    capabilities: {pure: false, readOnly: true}
})
export class HTTPTool implements Tool {
    readonly name = 'http';
    readonly description = 'Make HTTP requests (sandboxed)';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            url: {type: 'string', description: 'URL to request'},
            method: {type: 'string', description: 'HTTP method (GET, POST, etc.)'},
            headers: {type: 'object', description: 'Request headers'},
            body: {type: 'string', description: 'Request body'}
        },
        required: ['url']
    };

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {url, method = 'GET', headers = {}, body} = args as {
            url: string;
            method?: string;
            headers?: Record<string, string>;
            body?: string;
        };

        try {
            this.validateUrl(url);

            const response = await fetch(url, {
                method,
                headers,
                body: body || undefined
            });

            const text = await response.text();
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                success: true,
                content: {
                    status: response.status,
                    headers: responseHeaders,
                    body: text
                }
            };
        } catch (error) {
            return errorResult(error);
        }
    }

    private validateUrl(urlString: string): void {
        const url = new URL(urlString);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Only HTTP/HTTPS URLs are allowed');
        }
    }
}
