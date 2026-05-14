import type {LMClient} from './types.js';
import type {ModelRegistry, ModelRegistryEntry} from './model-registry.js';
import {Logger} from '../logger/index.js';

export interface RoutingStrategy {
    type: 'speed' | 'quality' | 'cost' | 'balanced' | 'custom';
    weight?: {
        speed: number;
        quality: number;
        cost: number;
    };
}

export interface RouterConfig {
    defaultStrategy: RoutingStrategy;
    enableAdaptiveRouting: boolean;
    maxRetries: number;
    timeoutMs: number;
}

export class LMRouter {
    private readonly registry: ModelRegistry;
    private readonly config: RouterConfig;
    private readonly logger: Logger;
    private ruleModelMap: Map<string, string> = new Map();

    constructor(registry: ModelRegistry, config: Partial<RouterConfig> = {}) {
        this.registry = registry;
        this.logger = new Logger({ scope: 'lm:router' });
        this.config = {
            defaultStrategy: config.defaultStrategy ?? {type: 'balanced'},
            enableAdaptiveRouting: config.enableAdaptiveRouting ?? true,
            maxRetries: config.maxRetries ?? 3,
            timeoutMs: config.timeoutMs ?? 30000
        };
    }

    selectModel(ruleId: string, context?: {
        termType?: string;
        memoryState?: {
            conceptCount: number;
            activationLevel: number;
        };
        urgency?: 'low' | 'medium' | 'high';
    }): string | null {
        const cached = this.ruleModelMap.get(ruleId);
        if (cached) {
            const entry = this.registry.get(cached);
            if (entry && entry.enabled) {
                return cached;
            }
        }

        const taskType = this.inferTaskType(ruleId);
        const selected = this.selectByStrategy(taskType, context);

        if (selected) {
            this.ruleModelMap.set(ruleId, selected);
        }

        return selected;
    }

    async executeWithRetry<T>(
        ruleId: string,
        executor: (client: LMClient) => Promise<T>,
        context?: Record<string, unknown>
    ): Promise<T> {
        const modelId = this.selectModel(ruleId, context);
        if (!modelId) {
            throw new Error('No available model for execution');
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            const entry = this.registry.get(modelId);
            if (!entry || !entry.enabled) {
                continue;
            }

            try {
                const client = entry.clientFactory();
                const result = await Promise.race([
                    executor(client),
                    new Promise<T>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), this.config.timeoutMs)
                    )
                ]);

                entry.stats.successfulCalls++;
                entry.stats.totalCalls++;

                return result;
            } catch (error) {
                entry.stats.failedCalls++;
                entry.stats.totalCalls++;
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.config.maxRetries - 1) {
                    this.logger.warn(`Attempt ${attempt + 1} failed for ${modelId}, retrying...`);
                }
            }
        }

        throw lastError || new Error(`Failed after ${this.config.maxRetries} attempts`);
    }

    enableRule(ruleId: string, modelId?: string): void {
        if (modelId) {
            this.ruleModelMap.set(ruleId, modelId);
        }
    }

    disableRule(ruleId: string): void {
        this.ruleModelMap.delete(ruleId);
    }

    isRuleEnabled(ruleId: string): boolean {
        const modelId = this.ruleModelMap.get(ruleId);
        if (modelId) {
            const entry = this.registry.get(modelId);
            return !!entry?.enabled;
        }
        return false;
    }

    private selectByStrategy(taskType: string, _context?: Record<string, unknown>): string | null {
        const strategy = this.config.defaultStrategy;
        const models = this.registry.list(true);

        if (models.length === 0) {
            return null;
        }

        switch (strategy.type) {
            case 'speed':
                return this.selectBySpeed(models);

            case 'quality':
                return this.selectByQuality(models);

            case 'cost':
                return this.selectByCost(models);

            case 'balanced':
                return this.selectBalanced(models, taskType);

            case 'custom':
                return this.selectCustom(models, strategy.weight);

            default:
                return models[0]?.id ?? null;
        }
    }

    private selectBySpeed(models: ModelRegistryEntry[]): string | null {
        return this.selectByProperty(models, 'speed', ['fast', 'medium', 'slow']);
    }

    private selectByQuality(models: ModelRegistryEntry[]): string | null {
        return this.selectByProperty(models, 'quality', ['high', 'medium', 'low']);
    }

    private selectByCost(models: ModelRegistryEntry[]): string | null {
        return this.selectByProperty(models, 'cost', ['low', 'medium', 'high']);
    }

    private selectByProperty<K extends 'speed' | 'quality' | 'cost'>(
        models: ModelRegistryEntry[],
        prop: K,
        order: ModelRegistryEntry['config'][K][]
    ): string | null {
        for (const value of order) {
            const model = models.find(m => m.config[prop] === value);
            if (model) return model.id;
        }
        return models[0]?.id ?? null;
    }

    private selectBalanced(models: ModelRegistryEntry[], taskType: string): string | null {
        if (taskType === 'translation' || taskType === 'parsing') {
            return this.selectBySpeed(models);
        }

        if (taskType === 'reasoning' || taskType === 'hypothesis') {
            return this.selectByQuality(models);
        }

        const mediumQuality = models.find(m =>
            m.config.quality === 'medium' && m.config.cost === 'medium'
        );
        return mediumQuality?.id || models[0]?.id || null;
    }

    private selectCustom(models: ModelRegistryEntry[], weight?: RoutingStrategy['weight']): string | null {
        if (!weight) {
            return models[0]?.id ?? null;
        }

        const scores = models.map(model => {
            let score = 0;

            if (model.config.speed === 'fast') score += weight.speed ?? 0.33;
            else if (model.config.speed === 'medium') score += (weight.speed ?? 0.33) * 0.5;

            if (model.config.quality === 'high') score += weight.quality ?? 0.33;
            else if (model.config.quality === 'medium') score += (weight.quality ?? 0.33) * 0.5;

            if (model.config.cost === 'low') score += weight.cost ?? 0.33;
            else if (model.config.cost === 'medium') score += (weight.cost ?? 0.33) * 0.5;

            return {id: model.id, score};
        });

        scores.sort((a, b) => b.score - a.score);
        return scores[0]?.id || null;
    }

    private inferTaskType(ruleId: string): string {
        if (ruleId.includes('translation') || ruleId.includes('parsing')) {
            return 'translation';
        }
        if (ruleId.includes('hypothesis') || ruleId.includes('reasoning')) {
            return 'reasoning';
        }
        if (ruleId.includes('decomposition') || ruleId.includes('planning')) {
            return 'decomposition';
        }
        return 'default';
    }
}
