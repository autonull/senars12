/**
 * MCP Server Basic Example
 * Demonstrates basic MCP server setup and usage
 */

import {SeNARSMCPServer} from '../api/mcp-server.js';
import {APIRegistry} from '../api/registry.js';
import {z} from 'zod';

async function main() {
	console.log('Starting MCP Server Example...\n');

	// Get registry instance
	const registry = APIRegistry.getInstance();

	// Register some example handlers
	registry.register('echo', {
		description: 'Echo back the input message',
		params: z.object({
			message: z.string(),
		}),
		returns: z.any(),
		handler: async (args: {message: string}) => {
			return {echo: args.message, timestamp: Date.now()};
		},
	});

	registry.register('add', {
		description: 'Add two numbers',
		params: z.object({
			a: z.number(),
			b: z.number(),
		}),
		returns: z.any(),
		handler: async (args: {a: number; b: number}) => {
			return {result: args.a + args.b};
		},
	});

	registry.register('reason', {
		description: 'Simple reasoning example',
		params: z.object({
			premise: z.string(),
			depth: z.number().default(3),
		}),
		returns: z.any(),
		handler: async (args: {premise: string; depth?: number}) => {
			// Simulate reasoning
			return {
				conclusion: `Based on "${args.premise}", we conclude...`,
				depth: args.depth,
			};
		},
	});

	// Create and start MCP server
	const server = new SeNARSMCPServer(registry, {
		name: 'senars-example',
		version: '1.0.0',
		transport: 'stdio',
	});

	try {
		await server.start();

		console.log('✓ MCP Server started');
		console.log(`Available tools: ${server.listTools().map((t) => t.name).join(', ')}`);
		console.log('\nServer is running. Press Ctrl+C to stop.\n');

		// Example: Execute a tool call
		console.log('Example tool execution:');
		const result = await server.handleToolCall('echo', {
			message: 'Hello MCP!',
		});
		console.log('Echo result:', result);

		// Keep running
		await new Promise(() => {});
	} catch (error) {
		console.error('Error:', error);
		await server.stop();
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}

export default main;
