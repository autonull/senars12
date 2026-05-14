import type {LMClient} from './types.js';
import type {ModelCapability, ModelRegistry, ModelRegistryEntry} from './model-registry.js';
import {errMsg} from '../utils';
import {Logger} from '../logger/index.js';

export interface ModelBenchmarkResult {
    modelId: string;
    tasks: BenchmarkTask[];
    results: BenchmarkResult[];
}

export interface BenchmarkTask {
    id: string;
    type: 'translation' | 'reasoning' | 'decomposition' | 'creative';
    prompt: string;
    expectedPattern?: string;
    timeout: number;
}

export interface BenchmarkResult {
    taskId: string;
    success: boolean;
    duration: number;
    tokens: number;
    score: number;
    error?: string;
}

export class ModelCapabilityDiscovery {
    private readonly registry: ModelRegistry;
    private readonly logger: Logger;

    constructor(registry: ModelRegistry) {
        this.registry = registry;
        this.logger = new Logger({ scope: 'lm:model-discovery' });
    }

    async discoverCapabilities(entry: ModelRegistryEntry): Promise<Partial<ModelCapability>> {
        const client = entry.clientFactory();
        const capabilities: Partial<ModelCapability> = {};

        try {
            const [contextWindow, supportsStructured] = await Promise.all([
                this.testContextWindow(client),
                this.testStructuredOutput(client)
            ]);

            capabilities.contextWindow = contextWindow;
            capabilities.supportsStructuredOutput = supportsStructured;
        } catch (error) {
            this.logger.warn(`Failed to discover capabilities for ${entry.id}: ${errMsg(error)}`);
        }

        return capabilities;
    }

    private async testContextWindow(client: LMClient): Promise<number> {
        const testSizes = [4096, 8192, 16384, 32768];
        let maxContext = 4096;

        for (const size of testSizes) {
            try {
                const prompt = 'Count to 10: '.repeat(size);
                await client.generateText(prompt, {maxTokens: 10});
                maxContext = size;
            } catch {
                break;
            }
        }

        return maxContext;
    }

    private async testStructuredOutput(client: LMClient): Promise<boolean> {
        try {
            const prompt = 'Respond with JSON only: {"test": true}';
            const response = await client.generateText(prompt);
            JSON.parse(response);
            return true;
        } catch {
            return false;
        }
    }
}

export class ModelBenchmark {
    private readonly registry: ModelRegistry;
    private readonly logger: Logger;
    private readonly defaultTasks: BenchmarkTask[] = [
        {
            id: 'translation-simple',
            type: 'translation',
            prompt: 'Translate to Narsese: "Birds are animals"',
            expectedPattern: '-->',
            timeout: 5000
        },
        {
            id: 'reasoning-deduction',
            type: 'reasoning',
            prompt: 'If A implies B, and B implies C, what is the relationship between A and C?',
            expectedPattern: '=>',
            timeout: 10000
        },
        {
            id: 'decomposition-complex',
            type: 'decomposition',
            prompt: 'Break down the goal "build a house" into subgoals',
            timeout: 15000
        }
    ];

    constructor(registry: ModelRegistry) {
        this.registry = registry;
        this.logger = new Logger({ scope: 'lm:model-benchmark' });
    }

    async benchmark(modelId: string, tasks: BenchmarkTask[] = this.defaultTasks): Promise<ModelBenchmarkResult> {
        const entry = this.registry.get(modelId);
        if (!entry) {
            throw new Error(`Model ${modelId} not found`);
        }

        const client = entry.clientFactory();
        const results: BenchmarkResult[] = [];

        for (const task of tasks) {
            const result = await this.runTask(client, task);
            results.push(result);
        }

        return {
            modelId,
            tasks,
            results
        };
    }

    async compareModels(modelIds: string[], tasks?: BenchmarkTask[]): Promise<Array<{
        modelId: string;
        averageScore: number;
        averageDuration: number
    }>> {
        const comparisons: Array<{ modelId: string; averageScore: number; averageDuration: number }> = [];

        for (const modelId of modelIds) {
            try {
                const benchmark = await this.benchmark(modelId, tasks);
                const avgScore = benchmark.results.reduce((sum, r) => sum + r.score, 0) / benchmark.results.length;
                const avgDuration = benchmark.results.reduce((sum, r) => sum + r.duration, 0) / benchmark.results.length;

                comparisons.push({modelId, averageScore: avgScore, averageDuration: avgDuration});
            } catch (error) {
                this.logger.warn(`Failed to benchmark ${modelId}: ${errMsg(error)}`);
            }
        }

        return comparisons.sort((a, b) => b.averageScore - a.averageScore);
    }

    private async runTask(client: LMClient, task: BenchmarkTask): Promise<BenchmarkResult> {
        const startTime = Date.now();

        try {
            const response = await Promise.race([
                client.generateText(task.prompt),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), task.timeout)
                )
            ]) as string;

            const duration = Date.now() - startTime;
            const tokens = response.length / 4;
            const success = !task.expectedPattern || response.includes(task.expectedPattern);
            const score = success ? (1 - duration / task.timeout) * 100 : 0;

            return {
                taskId: task.id,
                success,
                duration,
                tokens,
                score: Math.max(0, score)
            };
        } catch (error) {
            return {
                taskId: task.id,
                success: false,
                duration: Date.now() - startTime,
                tokens: 0,
                score: 0,
                error: errMsg(error)
            };
        }
    }

    private runBenchmarkSync(modelId: string, tasks: BenchmarkTask[] = this.defaultTasks): ModelBenchmarkResult {
        const entry = this.registry.get(modelId);
        if (!entry) {
            throw new Error(`Model ${modelId} not found`);
        }

        const results: BenchmarkResult[] = [];

        for (const task of tasks) {
            try {
                const response = `[SYNC] ${task.prompt}`;
                const duration = task.timeout;
                const tokens = response.length / 4;
                const success = true;
                const score = 50;

                results.push({
                    taskId: task.id,
                    success,
                    duration,
                    tokens,
                    score
                });
            } catch (error) {
                results.push({
                    taskId: task.id,
                    success: false,
                    duration: 0,
                    tokens: 0,
                    score: 0,
                    error: errMsg(error)
                });
            }
        }

        return {
            modelId,
            tasks,
            results
        };
    }
}

export const createModelCapabilityDiscovery = (registry: ModelRegistry): ModelCapabilityDiscovery => {
    return new ModelCapabilityDiscovery(registry);
};

export const createModelBenchmark = (registry: ModelRegistry): ModelBenchmark => {
    return new ModelBenchmark(registry);
};
