import {Client as McpClientSDK} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js';
import {EventEmitter} from 'events';

/**
 * Enhanced MCP client manager with connection status tracking and events.
 * Emits events for connection lifecycle to enable reactive programming patterns.
 *
 * @extends EventEmitter
 * @event 'connected' - Emitted when a client connects successfully
 * @event 'disconnected' - Emitted when a client disconnects
 * @event 'error' - Emitted when an error occurs
 * @event 'tool-called' - Emitted after a tool is called with result
 * @event 'tool-error' - Emitted when a tool call fails
 */
export class McpClientManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.opts = {
            timeout: 30_000,
            maxRetries: 3,
            retryDelay: 1000,
            ...options
        };
        this.clients = new Map(); // key -> McpClientSDK
        this.transports = new Map(); // key -> Transport
        this.status = new Map(); // key -> { connected, tools, lastError, connectedAt }
    }

    /**
     * Get connection status for a server
     * @param {string} key - Server identifier
     * @returns {Object|null} Status object or null if not found
     */
    getStatus(key) {
        return this.status.get(key) || null;
    }

    /**
     * Get all connected server keys
     * @returns {string[]} Array of server keys
     */
    getConnectedServers() {
        return Array.from(this.clients.keys());
    }

    /**
     * Check if a server is connected
     * @param {string} key - Server identifier
     * @returns {boolean} True if connected
     */
    isConnected(key) {
        const status = this.status.get(key);
        return status?.connected === true;
    }

    /**
     * Connect to an MCP server
     * @param {string} key - Server identifier for later reference
     * @param {string} commandOrUrl - Command (stdio) or URL (SSE)
     * @param {string[]} args - Arguments for stdio transport
     * @param {'stdio'|'sse'} transport - Transport type
     * @returns {Promise<McpClientSDK>} Connected client
     */
    async connect(key, commandOrUrl, args = [], transport = 'stdio') {
        if (this.clients.has(key)) {
            this.emit('debug', `Client ${key} already connected, returning existing`);
            return this.clients.get(key);
        }

        this._setStatus(key, {connected: false, connecting: true});

        try {
            const sdk = new McpClientSDK(
                {name: 'MeTTa', version: '4.1.0'},
                {capabilities: {sampling: {}, roots: {listChanged: true}}}
            );

            const tp = transport === 'sse'
                ? new SSEClientTransport(new URL(commandOrUrl))
                : new StdioClientTransport({command: commandOrUrl, args});

            // Set up transport event handlers
            tp.onclose = () => this._handleDisconnect(key);
            tp.onerror = (err) => this._handleTransportError(key, err);

            await sdk.connect(tp);

            // Store client and transport
            this.clients.set(key, sdk);
            this.transports.set(key, tp);

            // Update status
            this._setStatus(key, {
                connected: true,
                connecting: false,
                connectedAt: Date.now(),
                transport,
                tools: []
            });

            this.emit('connected', {key, transport});
            this.emit('debug', `Client ${key} connected via ${transport}`);

            return sdk;
        } catch (error) {
            this._setStatus(key, {
                connected: false,
                connecting: false,
                lastError: error.message
            });
            this.emit('error', {key, error});
            throw error;
        }
    }

    /**
     * Call a tool with automatic retry on failure
     * @param {string} key - Server identifier
     * @param {string} toolName - Tool name to call
     * @param {Object} params - Tool parameters
     * @param {number} retries - Number of retry attempts
     * @returns {Promise<Object>} Tool result
     */
    async callTool(key, toolName, params = {}, retries = this.opts.maxRetries) {
        const client = this.clients.get(key);
        if (!client) {
            const error = new Error(`MCP Client not found: ${key}`);
            this.emit('tool-error', {key, toolName, error});
            throw error;
        }

        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const result = await Promise.race([
                    client.callTool({name: toolName, arguments: params}),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error(`Timeout: ${toolName} (${this.opts.timeout}ms)`)), this.opts.timeout)
                    )
                ]);

                this.emit('tool-called', {key, toolName, params, result});
                return result;
            } catch (error) {
                lastError = error;
                this.emit('debug', `Tool call attempt ${attempt + 1} failed: ${error.message}`);

                if (attempt < retries) {
                    const delay = this.opts.retryDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        const finalError = new Error(`Tool ${toolName} failed after ${retries + 1} attempts: ${lastError.message}`);
        this.emit('tool-error', {key, toolName, params, error: finalError});
        throw finalError;
    }

    /**
     * List available tools for a server
     * @param {string} key - Server identifier
     * @returns {Promise<Object>} Tool list response
     */
    async listTools(key) {
        const client = this.clients.get(key);
        if (!client) {
            throw new Error(`MCP Client not found: ${key}`);
        }

        const tools = await client.listTools();

        // Cache tools in status
        const status = this.status.get(key);
        if (status) {
            status.tools = tools.tools || [];
            status.toolsUpdatedAt = Date.now();
        }

        return tools;
    }

    /**
     * Get cached tools for a server (faster, may be stale)
     * @param {string} key - Server identifier
     * @returns {Object[]|null} Cached tools or null if not available
     */
    getCachedTools(key) {
        const status = this.status.get(key);
        return status?.tools || null;
    }

    /**
     * Disconnect from a server
     * @param {string} key - Server identifier
     */
    async disconnect(key) {
        const tp = this.transports.get(key);
        if (tp) {
            try {
                await tp.close?.();
            } catch (error) {
                this.emit('debug', `Error closing transport for ${key}: ${error.message}`);
            }
            this.transports.delete(key);
            this.clients.delete(key);
            this.status.delete(key);
            this.emit('disconnected', {key});
        }
    }

    /**
     * Disconnect from all servers
     */
    async disconnectAll() {
        const keys = Array.from(this.transports.keys());
        for (const key of keys) {
            await this.disconnect(key);
        }
        this.emit('debug', 'All clients disconnected');
    }

    /**
     * Handle transport disconnect
     * @private
     */
    _handleDisconnect(key) {
        this._setStatus(key, {connected: false, disconnectedAt: Date.now()});
        this.emit('disconnected', {key, reason: 'transport-closed'});
    }

    /**
     * Handle transport error
     * @private
     */
    _handleTransportError(key, error) {
        this._setStatus(key, {lastError: error?.message || 'Unknown transport error'});
        this.emit('error', {key, error, source: 'transport'});
    }

    /**
     * Update status for a key
     * @private
     */
    _setStatus(key, updates) {
        const current = this.status.get(key) || {};
        this.status.set(key, {...current, ...updates});
    }

    /**
     * Get statistics about the manager
     * @returns {Object} Statistics
     */
    getStats() {
        const now = Date.now();
        return {
            connectedClients: this.clients.size,
            servers: this.getConnectedServers(),
            status: Object.fromEntries(this.status.entries()),
            uptime: {
                oldest: Math.min(...Array.from(this.status.values())
                    .filter(s => s.connectedAt)
                    .map(s => now - s.connectedAt)) || 0
            }
        };
    }
}

export default McpClientManager;
