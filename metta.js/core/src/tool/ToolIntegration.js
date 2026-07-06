import { ToolEngine } from './ToolEngine.js';
import { ToolRegistry } from './ToolRegistry.js';
import { BaseComponent } from '../util/BaseComponent.js';

/**
 * Integration layer that connects tools to the reasoning core
 */
export class ToolIntegration extends BaseComponent {
    /**
     * @param {object} config - Configuration for tool integration
     * @param {Array} additionalTools - Array of pre-instantiated tool instances
     */
    constructor(config = {}, additionalTools = []) {
        super({
            enableRegistry: true,
            enableDiscovery: true, // Legacy option, now ignored for tree-shaking
            ...config
        }, 'ToolIntegration');

        this.engine = new ToolEngine(this.config.engine ?? {});
        this.registry = this.config.enableRegistry ? new ToolRegistry(this.engine) : null;
        this.reasoningCore = null;
        this.toolUsageHistory = [];
        this.initialTools = additionalTools;
    }

    async _initialize() {
        if (this.reasoningCore) {
            await this.initializeTools();
        }
    }

    /**
     * Connect to the reasoning core
     * @param {object} reasoner - The reasoning core instance
     */
    connectToReasoningCore(reasoner) {
        this.reasoningCore = reasoner;
        this.logInfo('Connected tools to reasoning core');
        return this;
    }

    /**
     * Register all tools for the NAR system
     */
    async initializeTools() {
        if (!this.registry) {throw new Error('Tool registry not enabled');}

        try {
            // Register explicitly provided tools
            if (this.initialTools && this.initialTools.length > 0) {
                for (const tool of this.initialTools) {
                    try {
                        const metadata = this._getToolMetadata(tool);
                        this.registry.registerTool(metadata.id, tool, {
                            category: metadata.category,
                            description: metadata.description
                        });
                    } catch (toolError) {
                        this.logWarn(`Failed to register tool ${tool.constructor.name}: ${toolError.message}`);
                    }
                }
            }

            this.logInfo('Tools initialization completed', {
                toolCount: this.engine.getAvailableTools().length
            });
        } catch (error) {
            this.logWarn(`Tool initialization partially failed: ${error.message}`);
        }
        return this;
    }

    _getToolMetadata(tool) {
        // Map class names to metadata
        // This acts as a central registry for tool metadata without requiring imports
        const className = tool.constructor.name;

        const metadataMap = {
            'FileOperationsTool': {
                id: 'file-operations',
                category: 'file-operations',
                description: 'File operations including read, write, append, delete, list, and stat'
            },
            'CommandExecutorTool': {
                id: 'command-executor',
                category: 'command-execution',
                description: 'Safe command execution in sandboxed environment'
            },
            'WebAutomationTool': {
                id: 'web-automation',
                category: 'web-automation',
                description: 'Web automation including fetch, scrape, and check operations'
            },
            'MediaProcessingTool': {
                id: 'media-processing',
                category: 'media-processing',
                description: 'Media processing including PDF, image, and text extraction'
            },
            'EmbeddingTool': {
                id: 'embedding',
                category: 'embedding',
                description: 'Text embedding, similarity, and comparison operations'
            }
        };

        if (metadataMap[className]) {
            return metadataMap[className];
        }

        // Default fallback if metadata not found
        return {
            id: className.toLowerCase().replace(/tool$/, ''),
            category: 'general',
            description: tool.description || 'General purpose tool'
        };
    }

    /**
     * Execute a tool as part of reasoning process
     */
    async executeTool(toolId, params, context = {}) {
        const startTime = Date.now();
        try {
            const result = await this.engine.executeTool(toolId, params, { reasoningContext: context });
            const executionTime = this._logToolUsage(toolId, params, result, startTime, context);
            return { ...result, executionTime };
        } catch (error) {
            this.logError(`Tool execution failed: ${toolId}`, {
                error: error.message,
                params: JSON.stringify(params).substring(0, 200)
            });
            const errorResult = { success: false, error: error.message, toolId };
            const executionTime = this._logToolUsage(toolId, params, errorResult, startTime, context);
            return { ...errorResult, executionTime };
        }
    }

    _logToolUsage(toolId, params, result, startTime, context) {
        const executionTime = Date.now() - startTime;
        this.toolUsageHistory.push({
            toolId,
            params,
            result,
            executionTime,
            timestamp: Date.now(),
            context
        });

        if (this.toolUsageHistory.length > 1000) {
            this.toolUsageHistory.splice(0, this.toolUsageHistory.length - 500);
        }
    }

    /**
     * Execute multiple tools as part of reasoning
     */
    async executeTools(toolCalls, context = {}, sequential = false) {
        if (sequential) {
            const results = [];
            for (const call of toolCalls) {
                const result = await this.executeTool(call.toolId, call.params, context);
                results.push(result);
                if (!result.success && !call.continueOnError) {break;}
            }
            return results;
        }
        return Promise.all(toolCalls.map(call => this.executeTool(call.toolId, call.params, context)));
    }

    /**
     * Find tools that match certain criteria
     */
    findTools(criteria = {}) {
        return this.registry ? this.registry.findTools(criteria) : [];
    }

    /**
     * Get all available tools
     */
    getAvailableTools() {
        return this.engine.getAvailableTools();
    }

    /**
     * Get tool usage statistics
     */
    getUsageStats() {
        const { totalCalls, successfulCalls } = this.toolUsageHistory.reduce(
            (acc, item) => ({
                totalCalls: acc.totalCalls + 1,
                successfulCalls: acc.successfulCalls + (item.result.success ? 1 : 0),
            }),
            { totalCalls: 0, successfulCalls: 0 }
        );

        return {
            ...this.engine.getStats(),
            totalToolCalls: totalCalls,
            successfulToolCalls: successfulCalls,
            failedToolCalls: totalCalls - successfulCalls,
            lastToolCalls: this.toolUsageHistory.slice(-10),
        };
    }

    /**
     * Analyze tool usage patterns for intelligent selection
     */
    analyzeUsagePatterns() {
        const toolUsage = this.toolUsageHistory.reduce((acc, usage) => {
            acc[usage.toolId] ??= {
                totalCalls: 0,
                successfulCalls: 0,
                totalExecutionTime: 0,
            };

            acc[usage.toolId].totalCalls++;
            if (usage.result.success) {acc[usage.toolId].successfulCalls++;}
            acc[usage.toolId].totalExecutionTime += usage.executionTime;

            return acc;
        }, {});

        for (const data of Object.values(toolUsage)) {
            data.avgExecutionTime = data.totalExecutionTime / data.totalCalls;
            data.successRate = data.successfulCalls / data.totalCalls;
        }

        return toolUsage;
    }
}
