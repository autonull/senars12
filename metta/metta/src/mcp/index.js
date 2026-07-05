import {McpClientManager} from './McpClientManager.js';
import fs from 'fs';
import path from 'path';

/**
 * MeTTaMCPManager — one-call setup for MeTTa as MCP consumer.
 * Provides connection management, tool discovery, and utility methods.
 */
export class MeTTaMCPManager {
    constructor(interpreter, options = {}) {
        this.interpreter = interpreter;
        this.manager = new McpClientManager(options);

        // Inject the manager into the global scope
        // so `mcp-std.metta` can find it via `&js-global`.
        globalThis.mcpClientManager = this.manager;

        // Preload the MeTTa MCP stdlib
        const stdPath = path.join(process.cwd(), 'metta/src/mcp', 'mcp-std.metta');
        if (fs.existsSync(stdPath)) {
            this.interpreter.load(fs.readFileSync(stdPath, 'utf8'));
        }

        // Set up event forwarding to interpreter space (optional)
        this._setupEventForwarding();
    }

    /**
     * Set up event forwarding to MeTTa space
     * @private
     */
    _setupEventForwarding() {
        // Forward MCP events to MeTTa space as atoms
        this.manager.on('connected', ({key, transport}) => {
            this.interpreter.space.add({
                type: 'atom',
                name: 'mcp-connected',
                components: [{type: 'symbol', name: key}, {type: 'symbol', name: transport}]
            });
        });

        this.manager.on('disconnected', ({key}) => {
            this.interpreter.space.add({
                type: 'atom',
                name: 'mcp-disconnected',
                components: [{type: 'symbol', name: key}]
            });
        });

        this.manager.on('tool-called', ({key, toolName, result}) => {
            this.interpreter.space.add({
                type: 'atom',
                name: 'mcp-tool-success',
                components: [
                    {type: 'symbol', name: key},
                    {type: 'symbol', name: toolName}
                ]
            });
        });

        this.manager.on('tool-error', ({key, toolName, error}) => {
            this.interpreter.space.add({
                type: 'atom',
                name: 'mcp-tool-error',
                components: [
                    {type: 'symbol', name: key},
                    {type: 'symbol', name: toolName},
                    {type: 'symbol', name: error.message?.slice(0, 100) || 'Unknown error'}
                ]
            });
        });
    }

    /**
     * Connect to an MCP server via stdio
     * @param {string} key - Server identifier
     * @param {string} command - Command to run
     * @param {string[]} args - Command arguments
     * @returns {Promise<void>}
     */
    async connect(key, command, args = []) {
        await this.manager.connect(key, command, args, 'stdio');
        // Trigger discovery in MeTTa space
        this.interpreter.run(`!(mcp-discover "${key}")`);
    }

    /**
     * Connect to an MCP server via SSE
     * @param {string} key - Server identifier
     * @param {string} url - SSE endpoint URL
     * @returns {Promise<void>}
     */
    async connectSSE(key, url) {
        await this.manager.connect(key, url, [], 'sse');
        this.interpreter.run(`!(mcp-discover "${key}")`);
    }

    /**
     * Disconnect from a server or all servers
     * @param {string|null} key - Server identifier, or null for all
     * @returns {Promise<void>}
     */
    async disconnect(key) {
        if (key) {
            await this.manager.disconnect(key);
        } else {
            await this.manager.disconnectAll();
        }
    }

    /**
     * Check if a server is connected
     * @param {string} key - Server identifier
     * @returns {boolean}
     */
    isConnected(key) {
        return this.manager.isConnected(key);
    }

    /**
     * Get connection status
     * @param {string} key - Server identifier
     * @returns {Object|null}
     */
    getStatus(key) {
        return this.manager.getStatus(key);
    }

    /**
     * Get all connected servers
     * @returns {string[]}
     */
    getConnectedServers() {
        return this.manager.getConnectedServers();
    }

    /**
     * Get cached tools for a server
     * @param {string} key - Server identifier
     * @returns {Object[]|null}
     */
    getCachedTools(key) {
        return this.manager.getCachedTools(key);
    }

    /**
     * Get manager statistics
     * @returns {Object}
     */
    getStats() {
        return this.manager.getStats();
    }

    /**
     * Call a tool directly (bypassing MeTTa)
     * @param {string} key - Server identifier
     * @param {string} toolName - Tool name
     * @param {Object} params - Tool parameters
     * @returns {Promise<Object>}
     */
    async callTool(key, toolName, params = {}) {
        return this.manager.callTool(key, toolName, params);
    }

    /**
     * List tools for a server
     * @param {string} key - Server identifier
     * @returns {Promise<Object>}
     */
    async listTools(key) {
        return this.manager.listTools(key);
    }

    /**
     * Add event listener for MCP events
     * @param {string} event - Event name
     * @param {Function} listener - Event handler
     * @returns {MeTTaMCPManager}
     */
    on(event, listener) {
        this.manager.on(event, listener);
        return this;
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event handler
     * @returns {MeTTaMCPManager}
     */
    off(event, listener) {
        this.manager.off(event, listener);
        return this;
    }

    /**
     * Get the underlying McpClientManager
     * @returns {McpClientManager}
     */
    getManager() {
        return this.manager;
    }
}

/**
 * Create a MeTTaMCPManager instance
 * @param {Object} interpreter - MeTTaInterpreter instance
 * @param {Object} options - Manager options
 * @returns {MeTTaMCPManager}
 */
export function createMCPManager(interpreter, options = {}) {
    return new MeTTaMCPManager(interpreter, options);
}

export default MeTTaMCPManager;
