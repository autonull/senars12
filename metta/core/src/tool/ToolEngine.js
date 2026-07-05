import {BaseComponent} from '../util/BaseComponent.js';
import {Capability, CapabilityManager} from '../util/CapabilityManager.js';
import {PerformanceTracker} from './PerformanceTracker.js';
import {ExecutionHistory} from './ExecutionHistory.js';
import {generateId} from '../util/string.js';

export class ToolEngine extends BaseComponent {
    constructor(config = {}) {
        super({
            defaultTimeout: 5000,
            safetyLimits: {
                maxOutputSize: 10000,
                maxCommandLength: 1000
            },
            maxHistorySize: 1000,
            enableSandboxing: true,
            ...config
        }, 'ToolEngine');

        this.tools = new Map();
        this.activeExecutions = new Map();
        this.executionHistory = new ExecutionHistory(this.config.maxHistorySize);
        this.capabilityManager = config.capabilityManager ?? new CapabilityManager();
        this.performanceTracker = new PerformanceTracker();
    }

    async registerTool(id, tool, metadata = {}) {
        if (this.tools.has(id)) {throw new Error(`Tool with ID "${id}" already exists`);}

        this._validateToolInterface(id, tool);

        const toolCapabilities = tool.getCapabilities?.() ?? [];
        const toolData = this._createToolData(id, tool, metadata, toolCapabilities);

        this.tools.set(id, toolData);

        await this._registerToolCapabilities(toolCapabilities);
        await this._grantToolCapabilities(id, toolCapabilities);

        this.logInfo(`Registered tool: ${id} (${toolData.category})`, {
            name: tool.constructor.name,
            description: toolData.description,
            capabilities: toolData.capabilities
        });

        return this;
    }

    _validateToolInterface(id, tool) {
        if (!tool.execute || typeof tool.execute !== 'function') {
            throw new Error(`Tool "${id}" must have an execute method`);
        }

        if (!tool.getDescription || typeof tool.getDescription !== 'function') {
            throw new Error(`Tool "${id}" must have a getDescription method`);
        }
    }

    _createToolData(id, tool, metadata, capabilities) {
        return {
            id,
            instance: tool,
            name: tool.constructor.name,
            description: tool.getDescription(),
            parameters: tool.getParameterSchema?.() ?? {type: 'object', properties: {}},
            category: tool.getCategory?.() ?? 'general',
            capabilities,
            createdAt: Date.now(),
            usageCount: 0,
            lastUsed: null,
            ...metadata
        };
    }

    async _registerToolCapabilities(capabilities) {
        for (const capability of capabilities) {
            if (!this.capabilityManager.capabilities.has(capability)) {
                await this.capabilityManager.registerCapability(capability,
                    new Capability(capability, {
                        description: `Capability for ${capability}`,
                        scope: 'default',
                        permissions: []
                    })
                );
            }
        }
    }

    async _grantToolCapabilities(id, capabilities) {
        if (capabilities.length > 0) {
            await this.capabilityManager.grantCapabilities(id, capabilities, {
                grantedBy: 'system',
                approved: true
            });
        }
    }

    unregisterTool(id) {
        if (!this.tools.has(id)) {return false;}

        const tool = this.tools.get(id);
        this.tools.delete(id);
        this.logInfo(`Unregistered tool: ${id} (${tool.category})`);
        return true;
    }

    async executeTool(toolId, params = {}, context = {}) {
        const startTime = Date.now();
        const executionId = this._generateExecutionId();
        const tool = this.tools.get(toolId);

        if (!tool) {throw new Error(`Tool "${toolId}" not found`);}

        const executionContext = this._createExecutionContext(executionId, toolId, params, context, startTime);
        this.activeExecutions.set(executionId, executionContext);

        try {
            await this._validateExecution(toolId, tool, params);

            const timeout = context.timeout ?? this.config.defaultTimeout;
            const result = await this._executeWithTimeout(
                tool.instance.execute(params, {engine: this, executionId, context}),
                timeout,
                `Tool "${toolId}" execution timed out after ${timeout}ms`
            );

            const safeResult = this._sanitizeResult(result);
            return this._handleExecutionSuccess(executionContext, safeResult, startTime, tool);

        } catch (error) {
            return this._handleExecutionError(executionContext, error, startTime, tool);
        } finally {
            this.activeExecutions.delete(executionId);
        }
    }

    async _validateExecution(toolId, tool, params) {
        await this._validateToolCapabilities(toolId, tool);
        this._validateSafety(params);
        await this._validateToolParams(tool, params);
    }

    async _validateToolCapabilities(toolId, tool) {
        const hasRequiredCapabilities = await this.capabilityManager.hasAllCapabilities(toolId, tool.capabilities ?? []);
        if (!hasRequiredCapabilities) {
            const missingCaps = (tool.capabilities ?? []).filter(cap =>
                !this.capabilityManager.hasCapability(toolId, cap)
            );
            throw new Error(`Tool "${toolId}" lacks required capabilities: ${missingCaps.join(', ')}`);
        }
    }

    async _validateToolParams(tool, params) {
        if (tool.instance.validate && typeof tool.instance.validate === 'function') {
            const validationResult = tool.instance.validate(params);
            if (!validationResult.isValid) {
                throw new Error(`Tool parameters validation failed: ${validationResult.errors?.join(', ') ?? 'Unknown error'}`);
            }
        }
    }

    _createExecutionContext(executionId, toolId, params, context, startTime) {
        return {
            executionId,
            toolId,
            parameters: params,
            context: {
                user: context.user ?? 'system',
                session: context.session ?? null,
                timestamp: Date.now(),
                ...context
            },
            startTime,
            status: 'executing'
        };
    }

    _handleExecutionSuccess(executionContext, result, startTime, tool) {
        const {executionId, toolId} = executionContext;
        executionContext.endTime = Date.now();
        executionContext.duration = executionContext.endTime - startTime;
        executionContext.result = result;
        executionContext.status = 'completed';

        tool.usageCount++;
        tool.lastUsed = Date.now();

        this.performanceTracker.trackExecutionSuccess(toolId, startTime);
        this.executionHistory.add(executionContext);

        this.logInfo(`Tool execution completed: ${toolId} (${executionId}) in ${executionContext.duration}ms`);

        return {
            success: true,
            executionId,
            result,
            duration: executionContext.duration,
            toolId
        };
    }

    _handleExecutionError(executionContext, error, startTime, tool) {
        const {executionId, toolId, parameters} = executionContext;
        const endTime = Date.now();
        const duration = endTime - startTime;

        const errorContext = {
            executionId,
            toolId,
            parameters,
            error: error.message,
            stack: error.stack,
            duration,
            status: 'failed',
            context: executionContext.context
        };

        this.performanceTracker.trackExecutionFailure(toolId, startTime, error);
        this.executionHistory.add(errorContext);

        this.logError(`Tool execution failed: ${toolId} (${executionId})`, error);

        return {
            success: false,
            executionId,
            error: error.message,
            duration,
            toolId
        };
    }

    async executeTools(toolCalls, context = {}) {
        if (!Array.isArray(toolCalls)) {throw new Error('ToolCalls must be an array');}

        if (context.concurrent) {
            const promises = toolCalls.map(call =>
                this.executeTool(call.toolId, call.params, {...context, ...call.context})
            );
            return Promise.all(promises);
        } else {
            const results = [];
            for (const call of toolCalls) {
                const result = await this.executeTool(call.toolId, call.params, {...context, ...call.context});
                results.push(result);

                if (!result.success && context.continueOnError !== true) {break;}
            }
            return results;
        }
    }

    getAvailableTools() {
        return Array.from(this.tools.values()).map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            parameters: tool.parameters,
            capabilities: tool.capabilities,
            createdAt: tool.createdAt,
            usageCount: tool.usageCount,
            lastUsed: tool.lastUsed
        }));
    }

    getTool(toolId) {
        return this.tools.get(toolId) ?? null;
    }

    getToolsByCategory(category) {
        return Array.from(this.tools.values()).filter(tool => tool.category === category);
    }

    getExecutionHistory(options = {}) {
        return this.executionHistory.get(options, this.tools);
    }

    getStats() {
        return this.performanceTracker.getStats(this.tools);
    }

    _validateSafety(params) {
        const checkParam = (value, path = '') => {
            if (typeof value === 'string') {
                const dangerousPatterns = [
                    /rm\s+-rf/,
                    /exec\s*\(/,
                    /eval\s*\(/,
                    /import\s+subprocess/,
                    /import\s+os\.system/,
                    /import\s+os\.popen/,
                    /&&/,
                    /\|\|/,
                    /\|/,
                    />/,
                    /</,
                    /;/,
                    /chmod/,
                    /chown/,
                    /passwd/,
                    /useradd/,
                    /userdel/,
                    /su/,
                    /sudo/,
                ];

                for (const pattern of dangerousPatterns) {
                    if (pattern.test(value)) {
                        throw new Error(`Potential security risk detected in parameter${path ? ` (${path})` : ''}: ${value.substring(0, 50)}...`);
                    }
                }

                if (value.length > this.config.safetyLimits.maxCommandLength) {
                    throw new Error(`Parameter${path ? ` (${path})` : ''} exceeds maximum length limit`);
                }
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => checkParam(item, `${path}[${index}]`));
            } else if (value && typeof value === 'object') {
                Object.entries(value).forEach(([key, val]) => checkParam(val, `${path ? `${path}.` : ''}${key}`));
            }
        };

        checkParam(params);
    }

    _sanitizeResult(result) {
        const jsonString = JSON.stringify(result);

        if (jsonString.length > this.config.safetyLimits.maxOutputSize) {
            throw new Error(`Tool result exceeds maximum output size limit (${this.config.safetyLimits.maxOutputSize} chars)`);
        }

        return result;
    }

    _executeWithTimeout(promise, timeout, timeoutMessage) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeout);
            Promise.resolve(promise).then(resolve).catch(reject).finally(() => clearTimeout(timer));
        });
    }

    _generateExecutionId() {
        return generateId('exec');
    }

    cancelAllExecutions() {
        const count = this.activeExecutions.size;
        this.activeExecutions.clear();
        this.logWarn(`Canceled ${count} active tool executions`);
        return count;
    }

    async _dispose() {
        this.logInfo('Shutting down ToolEngine...');

        for (const [executionId, execution] of this.activeExecutions) {
            this.logWarn(`Canceling active execution: ${executionId} (tool: ${execution.toolId})`);
        }
        this.activeExecutions.clear();

        this.logInfo('ToolEngine shutdown complete');
    }
}