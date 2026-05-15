#!/usr/bin/env node
/**
 * MCP Server Standalone Executable
 * Starts MCP server with stdio transport for agent integration
 */

import {SeNARSMCPServer} from '../api/mcp-server.js';
import {APIRegistry} from '../api/registry.js';
import {createLogger} from '../nar/logger/index.js';
import {registerDefaultModels, getTurnkeyConfig} from '../nar/lm/defaults.js';

async function main() {
	const logger = createLogger({scope: 'mcp:bin'});

	try {
		logger.info('Starting SeNARS MCP Server...');

		// Register default models including Transformers.js
		registerDefaultModels();
		const config = getTurnkeyConfig();
		logger.info(`Default LM: ${config.lm.provider}/${config.lm.model}`);
		logger.info(`Fallback chain: ${config.fallbackChain.join(' -> ')}`);

		// Get or create API registry
		const registry = APIRegistry.getInstance();

		// Create MCP server with stdio transport (default)
		const server = new SeNARSMCPServer({
			name: 'senars-mcp',
			version: '1.0.0',
			transport: 'stdio',
		});

		await server.start();

		logger.info('MCP Server ready');
		logger.info(`Transport: stdio`);
		logger.info(`Tools: ${server.listTools().map((t) => t.name).join(', ') || 'none'}`);

		// Handle graceful shutdown
		process.on('SIGINT', async () => {
			logger.info('Received SIGINT, shutting down...');
			await server.stop();
			process.exit(0);
		});

		process.on('SIGTERM', async () => {
			logger.info('Received SIGTERM, shutting down...');
			await server.stop();
			process.exit(0);
		});

		// Keep process alive for stdio transport
		await new Promise(() => {});
	} catch (error) {
		logger.error("MCP Server failed", error instanceof Error ? error : new Error(String(error)));
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

export default main;
