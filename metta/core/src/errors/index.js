/**
 * Unified error hierarchy for SeNARS
 * Consolidates CustomErrors, ProviderError, AnalyzerErrors, ReasonerError, MeTTaErrors,
 * RL EnhancedErrors, and UI CustomErrors into a single canonical source.
 */

export class SeNARSError extends Error {
    #suggestion = null;
    #docsLink = null;

    constructor(message, {
        code = 'SE_NARS_ERROR',
        details = null,
        originalError = null,
        suggestion = null,
        docsLink = null
    } = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        this.originalError = originalError;
        this.timestamp = Date.now();
        if (suggestion) {
            this.#suggestion = suggestion;
        }
        if (docsLink) {
            this.#docsLink = docsLink;
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
        if (originalError?.stack) {
            this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
        }
    }

    get suggestion() {
        return this.#suggestion;
    }

    get docsLink() {
        return this.#docsLink;
    }

    withSuggestion(suggestion) {
        this.#suggestion = suggestion;
        return this;
    }

    withDocsLink(docsLink) {
        this.#docsLink = docsLink;
        return this;
    }

    toString() {
        let msg = `${this.name}: ${this.message}`;
        if (this.details && Object.keys(this.details).length > 0) {
            msg += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
        }
        if (this.#suggestion) {
            msg += `\nSuggestion: ${this.#suggestion}`;
        }
        if (this.#docsLink) {
            msg += `\nDocumentation: ${this.#docsLink}`;
        }
        return msg;
    }
}

// Backward-compat: EnhancedError with array suggestions + formatMessage
export class EnhancedError extends SeNARSError {
    constructor(message, suggestions = [], docsLink = null) {
        super(message, {
            code: 'ENHANCED_ERROR',
            suggestion: Array.isArray(suggestions) ? suggestions.join('; ') : suggestions,
            docsLink
        });
        this.suggestions = Array.isArray(suggestions) ? suggestions : [];
    }

    formatMessage() {
        let msg = this.message;
        if (this.suggestions.length > 0) {
            msg += `\n\n💡 Suggestions:\n${this.suggestions.map(s => `   - ${s}`).join('\n')}`;
        }
        if (this.docsLink) {
            msg += `\n\n📖 Documentation: ${this.docsLink}`;
        }
        return msg;
    }
}

// Core errors
export class ValidationError extends SeNARSError {
    constructor(message, {field = null, value = null, ...rest} = {}) {
        super(message, {code: 'VALIDATION_ERROR', details: {field, value}, ...rest});
        this.field = field;
        this.value = value;
    }
}

export class ConfigurationError extends SeNARSError {
    constructor(message, {key = null, value = null, expected = null, ...rest} = {}) {
        super(message, {code: 'CONFIGURATION_ERROR', details: {key, value, expected}, ...rest});
        this.key = key;
        this.value = value;
        this.expected = expected;
    }
}

export class ParseError extends SeNARSError {
    constructor(message, {position = null, source = null, ...rest} = {}) {
        super(message, {code: 'PARSE_ERROR', details: {position, source: source?.substring(0, 100)}, ...rest});
        this.position = position;
        this.source = source;
    }
}

export class ConnectionError extends SeNARSError {
    constructor(message, {providerType = null, endpoint = null, ...rest} = {}) {
        super(message, {code: 'CONNECTION_ERROR', details: {providerType, endpoint}, ...rest});
        this.providerType = providerType;
        this.endpoint = endpoint;
    }
}

export class ResourceError extends SeNARSError {
    constructor(message, {resourceType = null, resourceId = null, ...rest} = {}) {
        super(message, {code: 'RESOURCE_ERROR', details: {resourceType, resourceId}, ...rest});
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

export class TimeoutError extends SeNARSError {
    constructor(message, {operation = null, timeout = null, ...rest} = {}) {
        super(message, {code: 'TIMEOUT_ERROR', details: {operation, timeout}, ...rest});
        this.operation = operation;
        this.timeout = timeout;
    }
}

export class RuntimeError extends SeNARSError {
    constructor(message, {operation = null, context = null, ...rest} = {}) {
        super(message, {code: 'RUNTIME_ERROR', details: {operation, context}, ...rest});
        this.operation = operation;
        this.context = context;
    }
}

export class SerializationError extends SeNARSError {
    constructor(message, {entityType = null, entityData = null, ...rest} = {}) {
        super(message, {code: 'SERIALIZATION_ERROR', details: {entityType, entityData}, ...rest});
        this.entityType = entityType;
        this.entityData = entityData;
    }
}

export class DeserializationError extends SeNARSError {
    constructor(message, {entityType = null, entityData = null, ...rest} = {}) {
        super(message, {code: 'DESERIALIZATION_ERROR', details: {entityType, entityData}, ...rest});
        this.entityType = entityType;
        this.entityData = entityData;
    }
}

// Provider/LM errors
export class ProviderError extends SeNARSError {
    constructor(message, {...rest} = {}) {
        super(message, {code: 'PROVIDER_ERROR', ...rest});
    }
}

export class ModelNotFoundError extends SeNARSError {
    constructor(modelName) {
        super(`Model '${modelName}' not found`, {code: 'MODEL_NOT_FOUND_ERROR', details: {modelName}});
        this.modelName = modelName;
    }
}

export class InitializationError extends SeNARSError {
    constructor(message, {providerType = null, ...rest} = {}) {
        super(message, {code: 'INIT_ERROR', details: {providerType}, ...rest});
        this.providerType = providerType;
    }
}

export class ToolExecutionError extends SeNARSError {
    constructor(message, {toolName = null, input = null, ...rest} = {}) {
        super(message, {code: 'TOOL_EXECUTION_ERROR', details: {toolName, input}, ...rest});
        this.toolName = toolName;
        this.input = input;
    }
}

// Analyzer errors
export class AnalyzerError extends SeNARSError {
    constructor(message, {...rest} = {}) {
        super(message, {code: 'ANALYZER_ERROR', ...rest});
    }
}

export class AnalysisError extends SeNARSError {
    constructor(message, {analysisType = 'unknown', ...rest} = {}) {
        super(message, {code: `ANALYSIS_ERROR_${analysisType.toUpperCase()}`, details: {analysisType}, ...rest});
        this.analysisType = analysisType;
    }
}

// Reasoner errors
export class ReasonerError extends SeNARSError {
    constructor(message, {...rest} = {}) {
        super(message, {code: 'REASONER_ERROR', ...rest});
    }
}

export class RuleExecutionError extends SeNARSError {
    constructor(message, {ruleId = null, ...rest} = {}) {
        super(message, {code: 'RULE_EXECUTION_ERROR', details: {ruleId}, ...rest});
        this.ruleId = ruleId;
    }
}

export class PremiseSourceError extends SeNARSError {
    constructor(message, {sourceType = null, ...rest} = {}) {
        super(message, {code: 'PREMISE_SOURCE_ERROR', details: {sourceType}, ...rest});
        this.sourceType = sourceType;
    }
}

export class StreamProcessingError extends SeNARSError {
    constructor(message, {streamType = null, ...rest} = {}) {
        super(message, {code: 'STREAM_PROCESSING_ERROR', details: {streamType}, ...rest});
        this.streamType = streamType;
    }
}

// MeTTa errors
export class MeTTaError extends SeNARSError {
    #suggestion = null;

    constructor(message, {context = {}, ...rest} = {}) {
        super(message, {code: 'METTA_ERROR', details: context, ...rest});
        this.context = context;
    }

    get suggestion() {
        return this.#suggestion;
    }

    withSuggestion(suggestion) {
        this.#suggestion = suggestion;
        return this;
    }

    toString() {
        let msg = `${this.name}: ${this.message}`;
        if (this.context && Object.keys(this.context).length > 0) {
            msg += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
        }
        if (this.#suggestion) {
            msg += `\nSuggestion: ${this.#suggestion}`;
        }
        return msg;
    }
}

export class OperationNotFoundError extends MeTTaError {
    constructor(operationName, {availableOps = [], ...rest} = {}) {
        const similar = findSimilar(operationName, availableOps);
        const message = similar.length > 0
            ? `Operation '${operationName}' not found. Did you mean: ${similar.join(', ')}?`
            : `Operation '${operationName}' not found`;
        super(message, {context: {operationName, availableOps}, ...rest});
        this.withSuggestion('Check the operation name or use (help) to list available operations');
    }
}

export class NarsTypeError extends MeTTaError {
    constructor(message, expected, actual, {context = {}, ...rest} = {}) {
        super(message, {context: {...context, expected, actual}, ...rest});
        this.expected = expected;
        this.actual = actual;
        this.withSuggestion(`Expected ${expected}, but got ${actual}`);
    }
}

export class ReductionError extends MeTTaError {
    constructor(message, atom, step, limit, {context = {}, ...rest} = {}) {
        super(message, {context: {...context, atom: atom?.toString(), step, limit}, ...rest});
        this.atom = atom;
        this.step = step;
        this.limit = limit;
        if (step >= limit) {
            this.withSuggestion('Consider increasing maxReductionSteps or check for infinite recursion');
        }
    }
}

export class ExtensionError extends MeTTaError {
    constructor(extensionName, message, {context = {}, ...rest} = {}) {
        super(`Extension '${extensionName}' error: ${message}`, {context: {...context, extensionName}, ...rest});
        this.extensionName = extensionName;
    }
}

// WebSocket error
export class WebSocketConnectionError extends ConnectionError {
    constructor(message, {...rest} = {}) {
        super(message, {...rest});
    }
}

// UI-specific errors
export class GraphOperationError extends SeNARSError {
    constructor(message, {operation = 'unknown', ...rest} = {}) {
        super(message, {code: 'GRAPH_OPERATION_ERROR', details: {operation}, ...rest});
        this.operation = operation;
    }
}

export class MessageProcessingError extends SeNARSError {
    constructor(message, {messageType = 'unknown', ...rest} = {}) {
        super(message, {code: 'MESSAGE_PROCESSING_ERROR', details: {messageType}, ...rest});
        this.messageType = messageType;
    }
}

export class CommandExecutionError extends SeNARSError {
    constructor(message, {command = 'unknown', ...rest} = {}) {
        super(message, {code: 'COMMAND_EXECUTION_ERROR', details: {command}, ...rest});
        this.command = command;
    }
}

// RL / Neuro-symbolic errors
export class LifecycleError extends EnhancedError {
    constructor(issue, context = {}) {
        const {component, method, state} = context;
        let message = `Component lifecycle error: ${issue}`;
        const suggestions = [];
        if (method === 'act' && state === 'not_initialized') {
            message = `Component '${component}' not initialized before calling '${method}()'`;
            suggestions.push('Call await component.initialize() before using the component');
            suggestions.push('Example: const agent = new DQNAgent(env); await agent.initialize();');
        } else if (method === 'shutdown' && state === 'already_shutdown') {
            message = `Component '${component}' already shutdown`;
            suggestions.push('Check component.initialized before calling shutdown()');
        }
        super(message, suggestions, 'https://senars.ai/rl/components/lifecycle');
    }
}

export class EnvironmentError extends EnhancedError {
    constructor(issue, context = {}) {
        const {env, action, observation} = context;
        let message = `Environment error: ${issue}`;
        const suggestions = [];
        if (issue === 'not_reset') {
            message = `Environment '${env}' not reset before step()`;
            suggestions.push('Call env.reset() before starting an episode');
            suggestions.push('Example: const { observation } = env.reset();');
        } else if (issue === 'invalid_action') {
            message = `Invalid action ${action} for environment '${env}'`;
            suggestions.push('Check env.actionSpace for valid action range');
            suggestions.push('Use env.sampleAction() to get a valid random action');
        } else if (issue === 'episode_done') {
            message = `Cannot step in environment '${env}' after episode end`;
            suggestions.push('Call env.reset() to start a new episode');
        }
        super(message, suggestions, 'https://senars.ai/rl/environments/usage');
    }
}

export class AgentError extends EnhancedError {
    constructor(issue, context = {}) {
        const {agent, observation, action} = context;
        let message = `Agent error: ${issue}`;
        const suggestions = [];
        if (issue === 'not_trained') {
            message = `Agent '${agent}' acting without training`;
            suggestions.push('Train the agent first: await agent.train(env, { episodes: 100 })');
            suggestions.push('Or load a pre-trained model: await agent.load("./checkpoint.json")');
        } else if (issue === 'observation_shape_mismatch') {
            message = `Observation shape mismatch for agent '${agent}'`;
            suggestions.push('Check that observation dimensions match agent\'s expected input');
            suggestions.push(`Expected shape: ${observation?.expected ?? 'unknown'}`);
        }
        super(message, suggestions, 'https://senars.ai/rl/agents/training');
    }
}

export class TensorError extends EnhancedError {
    constructor(issue, context = {}) {
        const {expected, actual, operation} = context;
        let message = `Tensor error: ${issue}`;
        const suggestions = [];
        if (issue === 'shape_mismatch') {
            message = `Shape mismatch in ${operation}: expected [${expected}], got [${actual}]`;
            suggestions.push('Check tensor dimensions before the operation');
            suggestions.push('Use tensor.reshape() if dimensions are compatible');
        } else if (issue === 'dtype_mismatch') {
            message = `Data type mismatch in ${operation}: expected ${expected}, got ${actual}`;
            suggestions.push(`Convert tensor to ${expected} using tensor.cast('${expected}')`);
        }
        super(message, suggestions, 'https://senars.ai/tensor/operations');
    }
}

export class TrainingError extends EnhancedError {
    constructor(issue, context = {}) {
        const {episode, metric, value} = context;
        let message = `Training error: ${issue}`;
        const suggestions = [];
        if (issue === 'nan_loss') {
            message = `NaN loss detected at episode ${episode}`;
            suggestions.push('Reduce learning rate (try 0.0001 or lower)');
            suggestions.push('Check for reward scaling issues (normalize rewards)');
            suggestions.push('Add gradient clipping: { maxGradientNorm: 1.0 }');
        } else if (issue === 'divergence') {
            message = `Training divergence detected: ${metric} = ${value}`;
            suggestions.push('Reduce learning rate');
            suggestions.push('Increase batch size for more stable gradients');
            suggestions.push('Check for reward hacking or environment bugs');
        }
        super(message, suggestions, 'https://senars.ai/rl/training/debugging');
    }
}

export class ConfigError extends EnhancedError {
    constructor(issue, context = {}) {
        const {key, value, expected} = context;
        let message = `Configuration error: ${issue}`;
        const suggestions = [];
        if (issue === 'missing_required') {
            message = `Missing required configuration: '${key}'`;
            suggestions.push(`Add '${key}' to the configuration object`);
        } else if (issue === 'invalid_type') {
            message = `Invalid type for '${key}': expected ${expected}, got ${typeof value}`;
            suggestions.push(`Change '${key}' to type ${expected}`);
        } else if (issue === 'invalid_range') {
            message = `Value ${value} for '${key}' is out of range`;
            suggestions.push(`Use a value in the range: ${expected}`);
        }
        super(message, suggestions, 'https://senars.ai/rl/configuration');
    }
}

export class NeuroSymbolicError extends EnhancedError {
    constructor(issue, context = {}) {
        const {bridge, symbolic, neural} = context;
        let message = `Neuro-symbolic error: ${issue}`;
        const suggestions = [];
        if (issue === 'grounding_failed') {
            message = 'Failed to ground symbolic term to tensor';
            suggestions.push('Check that symbolic term is well-formed');
            suggestions.push('Ensure tensor shape matches grounding specification');
        } else if (issue === 'lift_failed') {
            message = 'Failed to lift tensor to symbolic representation';
            suggestions.push('Check tensor dimensions match expected symbolic structure');
            suggestions.push('Verify bridge configuration for symbolic mapping');
        }
        super(message, suggestions, 'https://senars.ai/rl/neuro-symbolic/bridge');
    }

    static wrap(error, message, context = {}) {
        return new NeuroSymbolicError(`${message}: ${error.message}`, {...context, originalError: error});
    }

    static component(component, message, context = {}) {
        return new NeuroSymbolicError(message, {code: `COMPONENT_${component.toUpperCase()}`, ...context});
    }

    static configuration(key, value, expected) {
        return new NeuroSymbolicError(`Invalid configuration for ${key}`, {
            code: 'CONFIGURATION_ERROR',
            details: {key, value, expected}
        });
    }

    static unavailable(component, reason) {
        return new NeuroSymbolicError(`${component} unavailable`, {
            code: 'COMPONENT_UNAVAILABLE',
            details: {component, reason}
        });
    }
}

// Error factory for RL scenarios
export const Errors = {
    lifecycle: (issue, context) => new LifecycleError(issue, context),
    environment: (issue, context) => new EnvironmentError(issue, context),
    agent: (issue, context) => new AgentError(issue, context),
    config: (issue, context) => new ConfigError(issue, context),
    tensor: (issue, context) => new TensorError(issue, context),
    training: (issue, context) => new TrainingError(issue, context),
    neuroSymbolic: (issue, context) => new NeuroSymbolicError(issue, context),
};

// Utility functions
function findSimilar(name, available) {
    return available
        .filter(op => op.includes(name) || name.includes(op) || levenshteinDistance(name, op) <= 2)
        .slice(0, 5);
}

function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= b.length; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

export function formatError(error) {
    return error instanceof MeTTaError ? error.toString() : `${error.name}: ${error.message}\n${error.stack ?? ''}`;
}

export function logError(error, {logger = console, includeStack = false} = {}) {
    logger.error(formatError(error));
    if (includeStack && error.stack) {
        logger.error(error.stack);
    }
}

export function tryCatch(fn, ...args) {
    return (typeof fn === 'function' ? fn(...args) : fn)
        .then(result => [null, result])
        .catch(error => [error, null]);
}

export function createErrorHandler(context) {
    return (error, additionalContext = {}) => {
        logError(error, {context: {...additionalContext, context}});
        throw new ReasonerError(
            `Error in ${context}: ${error.message}`,
            {code: 'CONTEXT_ERROR', originalError: error, details: {context, ...additionalContext}}
        );
    };
}

export function withErrorHandler(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            return createErrorHandler(context)(error);
        }
    };
}

export function validateConfig(config, schema, defaults = {}) {
    const validated = {...defaults};
    for (const [key, spec] of Object.entries(schema)) {
        const value = config[key];
        if (value === undefined) {
            if (spec.required) {
                throw new ConfigError('missing_required', {key, expected: spec.default});
            }
            validated[key] = defaults[key];
        } else if (typeof spec === 'function') {
            if (!spec(value)) {
                throw new ConfigurationError(`Invalid value for ${key}`, {key, value, expected: spec.name});
            }
            validated[key] = value;
        } else if (typeof spec === 'object' && spec.type) {
            if (typeof value !== spec.type) {
                throw new ConfigError('invalid_type', {key, value, expected: spec.type});
            }
            if (spec.range) {
                const [min, max] = spec.range;
                if (typeof value === 'number' && (value < min || value > max)) {
                    throw new ConfigError('invalid_range', {key, value, expected: `[${min}, ${max}]`});
                }
            }
            validated[key] = value;
        } else {
            validated[key] = value;
        }
    }
    return validated;
}

export class NotImplementedError extends SeNARSError {
    constructor(feature, {suggestion = null, ...rest} = {}) {
        super(`Not implemented: ${feature}`, {code: 'NOT_IMPLEMENTED', details: {feature, suggestion}, ...rest});
        this.feature = feature;
    }
}

export function handleError(error, context = '', fallbackMessage = 'An error occurred') {
    if (error instanceof ModelNotFoundError) {
        return `❌ Model Error: ${error.message}`;
    }
    if (error instanceof ConnectionError) {
        return `❌ Connection Error: ${error.message}`;
    }
    if (error instanceof ParseError) {
        return `❌ Parse Error: ${error.message}`;
    }
    if (error instanceof ConfigurationError) {
        return `❌ Configuration Error: ${error.message}`;
    }
    if (error.message?.includes('model') && error.message?.includes('not found')) {
        return `❌ Model Error: ${error.message}`;
    }
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
        return `❌ Connection Error: ${error.message}`;
    }
    return context ? `❌ ${context}: ${error.message || fallbackMessage}` : `❌ Error: ${error.message || fallbackMessage}`;
}
