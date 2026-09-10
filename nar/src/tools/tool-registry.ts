import {createLogger} from '../logger';
import {type EventBus, ToolError} from '../types';
import {errMsg} from '../utils';
import type {Term} from '../terms';
import {getTermArgs, isAtomic, isCompound} from '../terms';
import {getFixPatternMapping,} from './self-concept.js';
import type {
    Schema,
    Tool,
    ToolCapabilities,
    ToolChainResult,
    ToolChainStep,
    ToolContext,
    ToolEvent,
    ToolFilter,
    ToolRegistry,
    ToolResult,
    ToolStatistics,
} from './types';
import {errorResult} from './types';

const logger = createLogger({scope: 'ToolManager'});

type LifecycleState = 'initialized' | 'running' | 'stopped' | 'disposed';

export class Registry implements ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            throw new ToolError(`Tool '${tool.name}' is already registered`, {tool: tool.name});
        }
        this.tools.set(tool.name, tool);
    }

    unregister(name: string): void {
        this.tools.delete(name);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    list(_filter?: ToolFilter): Tool[] {
        return Array.from(this.tools.values());
    }

    async execute(
        name: string,
        args: Record<string, unknown>,
        context?: ToolContext
    ): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new ToolError(`Tool '${name}' not found`, {tool: name});
        }

        try {
            this.validateArgs(tool.parameters, args);
            const result = await tool.execute(args, context);
            return this.validateResult(result, tool);
        } catch (error) {
            return {
                success: false,
                content: null,
                error: errMsg(error),
            };
        }
    }

    async executeChain(chain: ToolChainStep[]): Promise<ToolChainResult> {
        const results: ToolResult[] = [];
        const outputVars: Record<string, unknown> = {};

        for (const step of chain) {
            const args = {...step.args};

            for (const [key, value] of Object.entries(args)) {
                if (typeof value === 'string' && value.startsWith('$')) {
                    const varName = value.slice(1);
                    if (outputVars[varName]) {
                        args[key] = outputVars[varName];
                    }
                }
            }

            const result = await this.execute(step.tool, args);
            results.push(result);

            if (!result.success) {
                return {
                    success: false,
                    results,
                    error: result.error,
                };
            }

            if (step.outputAs) {
                outputVars[step.outputAs] = result.content;
            }
        }

        return {
            success: true,
            results,
            finalContent: results[results.length - 1]?.content,
        };
    }

    getCapabilities(name: string): ToolCapabilities | undefined {
        const tool = this.tools.get(name);
        return tool?.capabilities;
    }

    private validateResult(result: ToolResult, _tool: Tool): ToolResult {
        if (result.partial && result.success) {
            if (!result.metadata?.hasMore) {
                result.partial = false;
            }
        }
        return result;
    }

    private validateArgs(schema: Schema, args: Record<string, unknown>): void {
        if (!schema) return;

        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in args)) {
                    throw new ToolError(`Missing required parameter: ${required}`, {
                        tool: schema.type,
                        parameter: required,
                    });
                }
            }
        }

        for (const [key, value] of Object.entries(args)) {
            const prop = schema.properties?.[key];
            if (prop) {
                this.validateType(key, value, prop);
            }
        }
    }

    private validateType(key: string, value: unknown, prop: Schema['properties'][string]): void {
        const typeChecks: Record<string, () => boolean> = {
            string: () => typeof value === 'string',
            number: () => typeof value === 'number',
            boolean: () => typeof value === 'boolean',
            array: () => Array.isArray(value),
            object: () => typeof value === 'object' && value !== null && !Array.isArray(value),
        };

        const check = typeChecks[prop.type];
        if (check && !check()) {
            throw new ToolError(`Invalid type for ${key}: expected ${prop.type}`, {
                parameter: key,
                expected: prop.type,
                actual: typeof value,
            });
        }

        if (prop.type === 'number') {
            if (prop.minimum !== undefined && (value as number) < prop.minimum) {
                throw new ToolError(`Value for ${key} is below minimum: ${prop.minimum}`, {
                    parameter: key,
                    minimum: prop.minimum,
                });
            }
            if (prop.maximum !== undefined && (value as number) > prop.maximum) {
                throw new ToolError(`Value for ${key} exceeds maximum: ${prop.maximum}`, {
                    parameter: key,
                    maximum: prop.maximum,
                });
            }
        }

        if (prop.type === 'string' && typeof value === 'string') {
            if (prop.minLength !== undefined && value.length < prop.minLength) {
                throw new ToolError(`String ${key} is too short`, {
                    parameter: key,
                    minLength: prop.minLength,
                });
            }
            if (prop.maxLength !== undefined && value.length > prop.maxLength) {
                throw new ToolError(`String ${key} is too long`, {
                    parameter: key,
                    maxLength: prop.maxLength,
                });
            }
            if (prop.pattern) {
                const regex = new RegExp(prop.pattern);
                if (!regex.test(value)) {
                    throw new ToolError(`String ${key} does not match pattern: ${prop.pattern}`, {
                        parameter: key,
                        pattern: prop.pattern,
                    });
                }
            }
            if (prop.enum && !prop.enum.includes(value)) {
                throw new ToolError(`String ${key} is not in allowed values`, {
                    parameter: key,
                    allowed: prop.enum,
                });
            }
        }
    }
}

export interface ToolDescriptor {
    name: string;
    description: string;
    capabilities?: ToolCapabilities;
    tags?: string[];
    version?: string;
}

export class ToolManager {
    private readonly registry = new Registry();
    private executionHistory: ToolEvent[] = [];
    private readonly statistics = new Map<string, ToolStatistics>();
    private readonly allowedPermissions = new Set<string>();
    private readonly toolDescriptors = new Map<string, ToolDescriptor>();
    private readonly lifecycleState = new Map<string, LifecycleState>();
    private readonly maxHistory = 100;
    private readonly sandboxMode: boolean;
    private eventBus?: EventBus;

    constructor(options?: {
        sandboxMode?: boolean;
        allowedPermissions?: string[];
        eventBus?: EventBus;
    }) {
        this.sandboxMode = options?.sandboxMode ?? false;
        this.eventBus = options?.eventBus;
        for (const p of options?.allowedPermissions ?? []) {
            this.allowedPermissions.add(p);
        }
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    on(event: string, callback: (data: unknown) => void): void {
        this.eventBus?.on(event as never, callback);
    }

    register(tool: Tool, descriptor?: ToolDescriptor): void {
        this.registry.register(tool);
        this.lifecycleState.set(tool.name, 'initialized');
        const resolvedDescriptor = descriptor ?? {
            name: tool.name,
            description: tool.description,
            capabilities: tool.capabilities,
            tags: tool.tags ?? [],
            version: '1.0.0',
        };
        this.toolDescriptors.set(tool.name, resolvedDescriptor);
        this.emit('tool:register', {name: tool.name, descriptor: resolvedDescriptor} as never);
    }

    unregister(name: string): void {
        this.stopTool(name);
        this.registry.unregister(name);
        this.statistics.delete(name);
        this.lifecycleState.delete(name);
        this.toolDescriptors.delete(name);
        this.emit('tool:unregister', {name} as never);
    }

    async initializeTool(name: string): Promise<boolean> {
        const tool = this.get(name);
        const ls = this.lifecycleState.get(name);
        if (!tool || ls === 'running' || ls === 'disposed') return false;

        if (
            tool.capabilities?.requiresPermissions &&
            !tool.capabilities.requiresPermissions.every((p) => this.allowedPermissions.has(p))
        ) {
            return false;
        }
        this.lifecycleState.set(name, 'running');
        this.emitState(name, 'running');
        return true;
    }

    async stopTool(name: string): Promise<boolean> {
        if (this.lifecycleState.get(name) !== 'running') return false;
        this.lifecycleState.set(name, 'stopped');
        this.emitState(name, 'stopped');
        return true;
    }

    async disposeTool(name: string): Promise<boolean> {
        if (this.lifecycleState.get(name) === 'disposed') return true;
        this.lifecycleState.set(name, 'disposed');
        this.emitState(name, 'disposed');
        return true;
    }

    getToolDescriptor(name: string): ToolDescriptor | undefined {
        return this.toolDescriptors.get(name);
    }

    discoverTools(filter?: { tags?: string[]; capabilities?: string[] }): ToolDescriptor[] {
        const all = Array.from(this.toolDescriptors.values());
        if (!filter) return all;

        return all.filter((desc) => {
            if (filter.tags && !filter.tags.every((tag) => desc.tags?.includes(tag))) return false;
            if (filter.capabilities) {
                const caps = desc.capabilities;
                if (!caps) return false;
                if (filter.capabilities.some((c) => c === 'pure' && !caps.pure)) return false;
                if (filter.capabilities.some((c) => c === 'readOnly' && !caps.readOnly)) return false;
            }
            return true;
        });
    }

    resolveConflict(
        tools: string[],
        context?: { preference?: 'first' | 'best' | 'random' }
    ): string | null {
        if (tools.length <= 1) return tools[0] ?? null;
        const preference = context?.preference || 'first';

        if (preference === 'best') {
            let best: string | null = null;
            let bestScore = -1;
            for (const name of tools) {
                const stats = this.getStatistics(name);
                const score = stats?.successfulCalls ? stats.successfulCalls / stats.totalCalls : 0;
                if (score > bestScore) {
                    bestScore = score;
                    best = name;
                }
            }
            return best || tools[0]!;
        }

        if (preference === 'random') {
            return tools[Math.floor(Math.random() * tools.length)]!;
        }

        return tools[0]!;
    }

    get(name: string): Tool | undefined {
        return this.registry.get(name);
    }

    list(filter?: ToolFilter): Tool[] {
        const all = this.registry.list();
        if (!filter) return all;

        return all.filter((tool) => {
            if (filter.tags && !filter.tags.every((tag) => tool.tags?.includes(tag))) return false;
            if (filter.readOnly && tool.capabilities?.readOnly !== true) return false;
            return true;
        });
    }

    async execute(
        name: string,
        args: Record<string, unknown>,
        context?: ToolContext
    ): Promise<ToolResult> {
        const startTime = Date.now();
        const tool = this.get(name);
        if (!tool) return errorResult(`Tool '${name}' not found`);

        const state = this.lifecycleState.get(name);
        if (state !== 'running' && state !== 'initialized') {
            return errorResult(`Tool '${name}' is not running (state: ${state})`);
        }

        if (this.sandboxMode && context?.permissions) {
            const required = tool.capabilities?.requiresPermissions || [];
            if (!required.every((p) => context.permissions?.has(p))) {
                return errorResult(`Missing required permissions: ${required.join(', ')}`);
            }
        }

        const budget = context?.budget;
        if (budget) {
            budget.executions = (budget.executions || 0) + 1;
            if (budget.maxExecutions && budget.executions > budget.maxExecutions) {
                return errorResult('Execution budget exceeded');
            }
        }

        const baseEvent = {name, args, timestamp: startTime, context} as const;
        this.emit('tool:call', {type: 'tool_call', ...baseEvent});
        this.addToHistory({type: 'tool_call', ...baseEvent});

        try {
            const result = await this.registry.execute(name, args, context);
            const duration = Date.now() - startTime;
            const resultEvent: ToolEvent = {
                type: 'tool_result',
                ...baseEvent,
                result,
                timestamp: Date.now(),
                duration,
            };

            if (budget) {
                budget.totalDuration = (budget.totalDuration || 0) + duration;
                if (budget.maxTotalDuration && budget.totalDuration > budget.maxTotalDuration) {
                    result.error = 'Duration budget exceeded';
                    result.success = false;
                }
            }

            this.updateStatistics(name, result, duration);
            this.emit('tool:result', resultEvent);
            this.addToHistory(resultEvent);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const result = {success: false, content: null, error: errorMsg};
            const errorEvent: ToolEvent = {
                type: 'tool_error',
                ...baseEvent,
                result,
                timestamp: Date.now(),
                duration,
            };

            this.updateStatistics(name, result, duration);
            this.emit('tool:error', errorEvent);
            this.addToHistory(errorEvent);
            throw error;
        }
    }

    executeChain = (chain: ToolChainStep[]): Promise<ToolChainResult> =>
        this.registry.executeChain(chain);

    getStatistics(name: string): ToolStatistics | undefined {
        return this.statistics.get(name);
    }

    getAllStatistics(): Map<string, ToolStatistics> {
        return new Map(this.statistics);
    }

    resetStatistics(name?: string): void {
        if (name) {
            this.statistics.delete(name);
            this.initializeStatistics(name);
        } else {
            this.statistics.clear();
        }
    }

    getHistory(limit = 10): ToolEvent[] {
        return this.executionHistory.slice(-limit);
    }

    clearHistory(): void {
        this.executionHistory = [];
    }

    /** Execute a tool goal from NAR (goals as ^tool_name(args) parsed to Inheritance(Product(args...), Atom('^tool'))) */
    async executeToolGoal(goalTerm: Term, context?: ToolContext): Promise<ToolResult> {
        // Parse AST: Inheritance(Product(args...), Atom('^toolName'))
        if (!isCompound(goalTerm) || goalTerm.kind !== 'inheritance') {
            return errorResult('Tool goal must be an Inheritance term (AST form: ^tool(args) -> Inheritance(Product, Atom))');
        }

        const args = getTermArgs(goalTerm);
        if (!args || args.length !== 2) {
            return errorResult('Invalid Inheritance structure for tool goal');
        }

        const subject = args[0];  // Product of arguments
        const predicate = args[1]; // Atom with ^toolName

        if (!subject || !predicate) {
            return errorResult('Invalid Inheritance structure: missing subject or predicate');
        }

        if (!isAtomic(predicate) || !predicate.symbol.startsWith('^')) {
            return errorResult('Tool goal predicate must be an Atom starting with ^');
        }

        const toolName = predicate.symbol.slice(1); // Remove ^ prefix

        // Check if tool exists
        const tool = this.get(toolName);
        if (!tool) {
            return errorResult(`Tool '${toolName}' not found`);
        }

        // Extract arguments from Product
        const parsedArgs = this.extractArgsFromProduct(subject);

        // Semantic resolution: fix_pattern_id → actual codemod strings, etc.
        const resolvedArgs = await this.resolveSemanticArgs(toolName, parsedArgs);

        logger.debug('Executing tool goal (AST)', {toolName, args: resolvedArgs});

        return this.execute(toolName, resolvedArgs, context);
    }

    async shutdown(): Promise<void> {
        await Promise.all(Array.from(this.lifecycleState.keys()).map((name) => this.disposeTool(name)));
    }

    /** Extract arguments from a Product term (or single term) into key-value pairs */
    private extractArgsFromProduct(subject: Term): Record<string, unknown> {
        const args: Record<string, unknown> = {};

        // Handle Product term with multiple args
        if (isCompound(subject) && subject.kind === 'product') {
            const productArgs = getTermArgs(subject);
            if (productArgs) {
                for (let i = 0; i < productArgs.length; i++) {
                    const arg = productArgs[i];
                    if (arg) {
                        const value = this.termToValue(arg);
                        // If the term is an Inheritance (compact form key:value), extract as key:value
                        if (isCompound(arg) && arg.kind === 'inheritance') {
                            const inhArgs = getTermArgs(arg);
                            if (inhArgs && inhArgs.length === 2) {
                                const subj = inhArgs[0];
                                const pred = inhArgs[1];
                                if (subj && pred && isAtomic(subj) && isAtomic(pred)) {
                                    // Compact form: subject:predicate means (predicate --> subject)
                                    // So key = predicate.symbol, value = subject.symbol
                                    args[pred.symbol] = subj.symbol;
                                    continue;
                                }
                            }
                        }
                        args[`arg${i}`] = value;
                    }
                }
            }
            return args;
        }

        // Single argument (non-Product)
        const value = this.termToValue(subject);
        args.arg0 = value;
        return args;
    }

    /** Convert a Narsese term to a JavaScript value */
    private termToValue(term: Term): unknown {
        if (isAtomic(term)) {
            const symbol = term.symbol;
            // Try to parse as primitive
            if (/^\d+$/.test(symbol)) return parseInt(symbol, 10);
            if (/^\d+\.\d+$/.test(symbol)) return parseFloat(symbol);
            if (symbol === 'true') return true;
            if (symbol === 'false') return false;
            if (symbol.startsWith('"') && symbol.endsWith('"')) return symbol.slice(1, -1);
            if (symbol.startsWith("'") && symbol.endsWith("'")) return symbol.slice(1, -1);
            // Return as concept reference string
            return symbol;
        }

        // For compound terms, return string representation
        return term.toString();
    }

    /** Semantic resolution: fix_pattern_id → actual codemod strings, etc. */
    private async resolveSemanticArgs(
        toolName: string,
        args: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        const resolved: Record<string, unknown> = {...args};

        // Resolve fix_pattern concept to actual codemod pattern
        if (toolName === 'apply_fix' && args.fixPattern) {
            const mapping = getFixPatternMapping(String(args.fixPattern));
            if (mapping) {
                resolved.pattern = mapping.pattern;
                resolved.replacement = mapping.replacement;
                resolved.lang = mapping.lang ?? 'typescript';
            }
        }

        // Resolve knob concept to actual knob name
        if (toolName === 'tune_knob' && args.knob) {
            const knobMap: Record<string, string> = {
                'knob:maxDerivationsPerStep': 'maxDerivationsPerStep',
                'knob:maxDerivationDepth': 'maxDerivationDepth',
                'knob:maxRulesPerCycle': 'maxRulesPerCycle',
                'knob:callTimeoutMs': 'callTimeoutMs',
                'knob:decayRate': 'decayRate',
                'knob:cpuThrottleMs': 'cpuThrottleMs',
                'knob:maxLoops': 'maxLoops',
                'knob:activationDecayRate': 'activationDecayRate',
                'knob:rankingMaxAdmissions': 'rankingMaxAdmissions',
                'knob:rankingMinScore': 'rankingMinScore',
            };
            resolved.knob = knobMap[String(args.knob)] ?? args.knob;
        }

        // Resolve strategy concept to actual strategy name
        if (toolName === 'switch_strategy' && args.strategy) {
            const strategyMap: Record<string, string> = {
                'strategy:focused': 'focused',
                'strategy:exhaustive': 'exhaustive',
                'strategy:anytime': 'anytime',
                'strategy:sampled': 'sampled',
                'strategy:priority': 'priority',
                'strategy:novelty': 'novelty',
                'strategy:goal-biased': 'goal-biased',
                'strategy:diverse': 'diverse',
            };
            resolved.strategy = strategyMap[String(args.strategy)] ?? args.strategy;
        }

        // Resolve capability template
        if (toolName === 'scaffold_capability' && args.templateId) {
            const templateMap: Record<string, string> = {
                'tool_template': 'tool_template',
                'rule_template': 'rule_template',
            };
            resolved.templateId = templateMap[String(args.templateId)] ?? args.templateId;
        }

        return resolved;
    }

    private emit(event: string, data: unknown): void {
        this.eventBus?.emit(event as never, data as never);
    }

    private emitState(name: string, state: LifecycleState): void {
        this.emit(`tool:${state === 'running' ? 'init' : state}`, {name, state});
    }

    private initializeStatistics(name: string): void {
        if (!this.statistics.has(name)) {
            this.statistics.set(name, {
                name,
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                totalDuration: 0,
                averageDuration: 0,
            });
        }
    }

    private updateStatistics(name: string, result: ToolResult, duration: number): void {
        const stats = this.statistics.get(name);
        if (!stats) return;

        stats.totalCalls++;
        stats.successfulCalls += result.success ? 1 : 0;
        stats.failedCalls += result.success ? 0 : 1;
        stats.totalDuration += duration;
        stats.averageDuration = stats.totalDuration / stats.totalCalls;
        stats.lastCalled = Date.now();
    }

    private addToHistory(event: ToolEvent): void {
        this.executionHistory.push(event);
        if (this.executionHistory.length > this.maxHistory) {
            this.executionHistory.shift();
        }
    }
}
