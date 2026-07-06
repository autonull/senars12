/**
 * @file src/tools/ToolRegistry.js
 * @description Automatic tool discovery and registration system
 */

import {BaseComponent} from '../util/BaseComponent.js';
import {ToolEngine} from './ToolEngine.js';
import {ToolDiscovery} from './ToolDiscovery.js';

/**
 * Tool Registry that provides automatic tool discovery and registration
 * Follows patterns from v8/coreagent/tools architecture
 */
export class ToolRegistry extends BaseComponent {
    /**
     * @param {ToolEngine} toolEngine - The tool engine instance to register tools with
     */
    constructor(toolEngine, config = {}) {
        super(config, 'ToolRegistry');

        if (!toolEngine || !(toolEngine instanceof ToolEngine)) {
            throw new Error('ToolRegistry requires a valid ToolEngine instance');
        }

        this.engine = toolEngine;
        this.discoveredTools = new Map();
        this.registrationHistory = [];
        this.discoveryPaths = ['src/tools/executors', 'plugins', 'node_modules'];
        this.autoDiscoveryEnabled = false;
        this.discoveryInterval = null;
    }

    /**
     * Discovers tools in a given directory or set of modules
     * @param {Array<Function|Object>} toolClasses - Array of tool classes or objects to discover
     * @param {object} [options] - Discovery options
     * @param {boolean} [options.cache] - Whether to cache discovered tools (default: true)
     * @returns {Array<object>} - Discovered tool metadata
     */
    discoverTools(toolClasses, options = {}) {
        const discovered = ToolDiscovery.discover(toolClasses);
        const shouldCache = options.cache !== false;

        if (shouldCache) {
            for (const toolMetadata of discovered) {
                this.discoveredTools.set(toolMetadata.id, {
                    class: toolMetadata.class,
                    metadata: toolMetadata
                });
                this.logger.info(`Discovered tool: ${toolMetadata.id}`, {
                    name: toolMetadata.name,
                    category: toolMetadata.category ?? 'unknown',
                    description: toolMetadata.description
                });
            }
        }

        return discovered;
    }

    /**
     * Registers all discovered tools with the engine
     * @param {Array<string>} [includeOnly] - Optional list of tool IDs to register (if not provided, registers all)
     * @param {object} [defaultConfig] - Default configuration to apply to tools
     * @param {object} [metadataOverrides] - Metadata overrides for registered tools
     * @returns {Array<string>} - IDs of successfully registered tools
     */
    registerAll(includeOnly = null, defaultConfig = {}, metadataOverrides = {}) {
        const toRegister = includeOnly ?? Array.from(this.discoveredTools.keys());
        const registered = [];

        for (const toolId of toRegister) {
            if (this.discoveredTools.has(toolId)) {
                const {class: ToolClass, metadata} = this.discoveredTools.get(toolId);

                try {
                    // Create an instance of the tool
                    const toolInstance = typeof ToolClass === 'function'
                        ? new ToolClass({...defaultConfig, ...metadataOverrides})
                        : ToolClass;

                    // Merge metadata with overrides
                    const mergedMetadata = {
                        ...metadata,
                        ...metadataOverrides
                    };

                    // Register the tool with the engine
                    this.engine.registerTool(toolId, toolInstance, mergedMetadata);

                    registered.push(toolId);

                    // Log registration in history
                    this._logRegistration(toolId, mergedMetadata);

                    this.logger.info(`Registered tool: ${toolId} (${mergedMetadata.category ?? 'unknown'})`);
                } catch (error) {
                    this.logger.error(`Failed to register tool ${toolId}:`, {
                        error: error.message
                    });
                }
            }
        }

        return registered;
    }

    /**
     * Log tool registration to history
     * @private
     */
    _logRegistration(toolId, metadata) {
        this.registrationHistory.push({
            toolId,
            timestamp: Date.now(),
            action: 'register',
            metadata: metadata
        });
    }

    /**
     * Registers a single tool
     * @param {string} id - Tool ID
     * @param {object} tool - Tool instance
     * @param {object} [metadata] - Tool metadata
     * @returns {ToolRegistry} - Returns this instance for chaining
     */
    registerTool(id, tool, metadata = {}) {
        try {
            this.engine.registerTool(id, tool, metadata);
            this._logRegistration(id, metadata);

            this.logger.info(`Manually registered tool: ${id} (${metadata.category ?? 'unknown'})`);
            return this;
        } catch (error) {
            this.logger.error(`Failed to manually register tool ${id}:`, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Auto-registers tools from a directory or module
     * @param {object} toolModule - Module containing tool classes
     * @param {object} [options] - Registration options
     * @param {Array<string>} [options.include] - Only register tools with these IDs
     * @param {Array<string>} [options.exclude] - Don't register tools with these IDs
     * @param {object} [options.config] - Default configuration for tools
     * @param {object} [options.metadata] - Metadata overrides for all registered tools
     * @returns {Array<string>} - Registered tool IDs
     */
    autoRegisterFromModule(toolModule, options = {}) {
        const {include, exclude, config = {}, metadata = {}} = options;

        const discoveredTools = ToolDiscovery.discover(Object.values(toolModule));

        const toolsToRegister = discoveredTools.filter(tool => {
            const toolId = this._generateToolId(tool.name, tool.class);
            if (exclude?.includes(toolId)) {return false;}
            if (include && !include.includes(toolId)) {return false;}
            return true;
        });

        for (const tool of toolsToRegister) {
            this.discoveredTools.set(tool.id, {
                class: tool.class,
                metadata: tool
            });
        }

        const toolIdsToRegister = toolsToRegister.map(tool => tool.id);

        return this.registerAll(toolIdsToRegister, config, metadata);
    }

    /**
     * Generate a tool ID based on the key or class name
     * @private
     */
    _generateToolId(key, value) {
        return key.toLowerCase().replace(/tool$/, '') ??
            (value.name ? value.name.toLowerCase().replace(/tool$/, '') : key);
    }


    /**
     * Gets all discovered tools
     * @returns {Array<object>} - Array of discovered tool metadata
     */
    getDiscoveredTools() {
        return Array.from(this.discoveredTools.values()).map(({metadata}) => metadata);
    }

    /**
     * Gets registration history
     * @returns {Array<object>} - Registration history
     */
    getRegistrationHistory() {
        return [...this.registrationHistory];
    }

    /**
     * Validates a tool instance
     * @param {object} tool - Tool instance to validate
     * @returns {object} - Validation result
     */
    validateTool(tool) {
        const errors = [];

        if (!tool.execute || typeof tool.execute !== 'function') {
            errors.push('Missing execute method');
        }

        if (!tool.getDescription || typeof tool.getDescription !== 'function') {
            errors.push('Missing getDescription method');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    findTools(criteria = {}) {
        const matching = [];
        for (const [id, { class: ToolClass, metadata }] of this.discoveredTools.entries()) {
            if (this.#matchesCriteria(metadata, criteria)) {
                matching.push({ id, class: ToolClass, metadata });
            }
        }
        return matching;
    }

    #matchesCriteria(metadata, criteria) {
        if (criteria.category && metadata.category !== criteria.category) {return false;}
        if (criteria.supportsStreaming !== undefined && metadata.supportsStreaming !== criteria.supportsStreaming) {return false;}
        if (criteria.requiredCapabilities?.length) {
            for (const cap of criteria.requiredCapabilities) {
                if (!metadata.capabilities?.includes(cap)) {return false;}
            }
        }
        return true;
    }

    /**
     * Starts auto-discovery of tools
     * @param {object} [options] - Discovery options
     * @param {number} [options.interval] - Interval in milliseconds (default: 30000)
     * @param {Array<string>} [options.paths] - Paths to search for tools
     */
    startAutoDiscovery(options = {}) {
        if (this.discoveryInterval) {
            this.logger.warn('Auto-discovery already running');
            return;
        }

        const {interval = 30000, paths = this.discoveryPaths} = options;
        this.discoveryPaths = paths;
        this.autoDiscoveryEnabled = true;

        this.discoveryInterval = setInterval(() => {
            this.performAutoDiscovery();
        }, interval);

        this.logger.info('Auto-discovery started with interval:', interval);
    }

    /**
     * Stops auto-discovery of tools
     */
    stopAutoDiscovery() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
            this.autoDiscoveryEnabled = false;
            this.logger.info('Auto-discovery stopped');
        }
    }

    /**
     * Performs one-time auto-discovery in configured paths
     */
    async performAutoDiscovery() {
        for (const path of this.discoveryPaths) {
            try {
                await this.discoverToolsInPath(path);
            } catch (error) {
                this.logger.debug(`Failed to discover tools in path ${path}:`, error.message);
            }
        }
    }

    /**
     * Discovers tools in a specific path (placeholder implementation)
     * @private
     */
    async discoverToolsInPath(path) {
        // This would typically scan directories for tool files
        // For now, we'll implement a basic version that looks for known patterns
        const discoveryKey = `path_${path}_${Date.now()}`;

        if (this.discoveredTools.has(discoveryKey)) {return;}
        this.discoveredTools.set(discoveryKey, {path, timestamp: Date.now()});

        // Clean old discovery records (keep for 5 minutes)
        for (const [key, record] of this.discoveredTools.entries()) {
            if (typeof record.timestamp === 'number' && Date.now() - record.timestamp > 300000) {
                this.discoveredTools.delete(key);
            }
        }
    }

    /**
     * Gets statistics about the registry
     * @returns {object} - Registry statistics
     */
    getStats() {
        return {
            totalDiscoveredTools: this.discoveredTools.size,
            registrationHistoryCount: this.registrationHistory.length,
            autoDiscoveryEnabled: this.autoDiscoveryEnabled,
            discoveryPaths: this.discoveryPaths,
            lastDiscovery: Math.max(...Array.from(this.discoveredTools.values()).map(d => d.timestamp ?? 0)) ?? 0
        };
    }
}