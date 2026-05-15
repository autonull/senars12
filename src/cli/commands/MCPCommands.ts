import {SeNARSMCPServer} from '../../api/mcp-server.js';
import {createLogger} from '../../nar/logger/index.js';
import {registerDefaultModels, getTurnkeyConfig} from '../../nar/lm/defaults.js';

interface MCPCommandOptions {
	transport?: 'stdio' | 'sse' | 'http';
	port?: number;
	name?: string;
	version?: string;
}

export async function startMCPServer(options: MCPCommandOptions = {}): Promise<void> {
	const logger = createLogger({scope: 'cli:mcp'});

	try {
		logger.info('Starting MCP Server...');
		registerDefaultModels();
		const config = getTurnkeyConfig();
		logger.info(`Default LM: ${config.lm.provider}/${config.lm.model}`);

		const server = new SeNARSMCPServer({
			transport: options.transport ?? 'stdio',
			port: options.port ?? 8766,
			name: options.name ?? 'senars-mcp',
			version: options.version ?? '1.0.0',
		});

		await server.start();
		logger.info('MCP Server started');
		logger.info(`Transport: ${options.transport ?? 'stdio'}`);
		logger.info(`Tools: ${server.listTools().map(t => t.name).join(', ')}`);

		const shutdown = async () => { logger.info('Shutting down...'); await server.stop(); process.exit(0); };
		for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

		await new Promise(() => {});
	} catch (error) {
		logger.error('Failed to start MCP Server', error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}
