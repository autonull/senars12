import type {Schema, Tool, ToolContext, ToolResult} from './types.js';
import {errorResult} from './types.js';

export interface BraveSearchConfig {
	apiKeyEnv: string;
	defaultCount: number;
}

export class BraveSearchTool implements Tool {
	readonly name = 'brave-search';
	readonly description = 'Search the web using Brave Search API';
	readonly parameters: Schema = {
		type: 'object',
		properties: {
			query: {type: 'string', description: 'Search query'},
			count: {type: 'number', description: 'Number of results (default: 5)', minimum: 1, maximum: 20}
		},
		required: ['query']
	};

	private readonly apiKey?: string;
	private readonly defaultCount: number;

	constructor(config: BraveSearchConfig) {
		this.apiKey = process.env[config.apiKeyEnv];
		this.defaultCount = config.defaultCount ?? 5;
	}

	async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<ToolResult> {
		const {query, count = this.defaultCount} = args as { query: string; count?: number };

		if (!this.apiKey) {
			return {
				success: false,
				content: {error: 'Brave API key not configured. Set BRAVE_API_KEY environment variable.'},
				metadata: {}
			};
		}

		try {
			const url = new URL('https://api.search.brave.com/res/v1/web/search');
			url.searchParams.set('q', query);
			url.searchParams.set('count', Math.min(count, 20).toString());

			const response = await fetch(url.toString(), {
				headers: {
					'Accept': 'application/json',
					'X-Subscription-Token': this.apiKey
				}
			});

			if (!response.ok) {
				throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json() as BraveSearchResponse;
			const results = data.web?.results ?? [];

			return {
				success: true,
				content: {
					count: results.length,
					results: results.map(r => ({
						title: r.title,
						url: r.url,
						snippet: r.description
					}))
				},
				metadata: {totalFound: results.length, query}
			};
		} catch (error) {
			return errorResult(error);
		}
	}
}

interface BraveSearchResponse {
	web?: {
		results: Array<{
			title: string;
			url: string;
			description: string;
		}>;
	};
}
