/**
 * MCP Server CLI Command
 * Starts the MCP server with specified transport
 */

import {SeNARSMCPServer} from '../../api/mcp-server.js';
import {APIRegistry} from '../../api/registry.js';
import {createLogger} from '../../nar/logger/index.js';
import {registerDefaultModels, getTurnkeyConfig} from '../../nar/lm/defaults.js';

interface MCPCommandOptions {
	transport?: 'stdio' | 'sse' | 'http';
	port?: number;
	name?: string;
	version?: string;
}

export async function startMCPServer(
	options: MCPCommandOptions = {}
): Promise<void> {
	const logger = createLogger({scope: 'cli:mcp'});

	try {
		logger.info('Starting MCP Server...');

		// Register default LM models for turnkey operation
		registerDefaultModels();
		const config = getTurnkeyConfig();
		logger.info(`Default LM: ${config.lm.provider}/${config.lm.model}`);

		// Get or create API registry
		const registry = APIRegistry.getInstance();

		// Create and start MCP server
		const server = new SeNARSMCPServer(registry, {
			transport: options.transport || 'stdio',
			port: options.port || 8766,
			name: options.name || 'senars-mcp',
			version: options.version || '1.0.0',
		});

		await server.start();

		logger.info('MCP Server started successfully');
		logger.info(`Transport: ${options.transport || 'stdio'}`);
		logger.info(`Available tools: ${server.listTools().map((t) => t.name).join(', ')}`);

		// Handle graceful shutdown
		process.on('SIGINT', async () => {
			logger.info('Shutting down MCP Server...');
			await server.stop();
			process.exit(0);
		});

		process.on('SIGTERM', async () => {
			logger.info('Shutting down MCP Server...');
			await server.stop();
			process.exit(0);
		});

		// Keep process alive
		await new Promise(() => {});
	} catch (error) {
		logger.error("Failed to start MCP Server", error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}

export default startMCPServer;
