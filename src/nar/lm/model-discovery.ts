import type {LMClient} from './types.js';
import type {ModelCapability, ModelRegistry, ModelRegistryEntry} from './model-registry.js';
import {errMsg} from '../utils';
import {createLogger, type Logger} from '../logger/index.js';

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
        this.logger = createLogger({scope: 'lm:model-discovery'});
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
                await client.generateText('Count to 10: '.repeat(size), {maxTokens: 10});
                maxContext = size;
            } catch (e) { console.error('Context test failed:', e); break; }
        }

        return maxContext;
    }

    private async testStructuredOutput(client: LMClient): Promise<boolean> {
        try {
            JSON.parse(await client.generateText('Respond with JSON only: {"test": true}'));
            return true;
        } catch (e) { console.error('Structured output test failed:', e); return false; }
    }
}

export class ModelBenchmark {
    private readonly registry: ModelRegistry;
    private readonly logger: Logger;
    private readonly defaultTasks: BenchmarkTask[] = [
        {id: 'translation-simple', type: 'translation', prompt: 'Translate to Narsese: "Birds are animals"', expectedPattern: '-->', timeout: 5000},
        {id: 'reasoning-deduction', type: 'reasoning', prompt: 'If A implies B, and B implies C, what is the relationship between A and C?', expectedPattern: '=>', timeout: 10000},
        {id: 'decomposition-complex', type: 'decomposition', prompt: 'Break down the goal "build a house" into subgoals', timeout: 15000}
    ];

    constructor(registry: ModelRegistry) {
        this.registry = registry;
        this.logger = createLogger({scope: 'lm:model-benchmark'});
    }

    async benchmark(modelId: string, tasks: BenchmarkTask[] = this.defaultTasks): Promise<{modelId: string; tasks: BenchmarkTask[]; results: BenchmarkResult[]}> {
        const entry = this.registry.get(modelId);
        if (!entry) throw new Error(`Model ${modelId} not found`);

        const client = entry.clientFactory();
        const results = await Promise.all(tasks.map(task => this.runTask(client, task)));

        return {modelId, tasks, results};
    }

    async compareModels(modelIds: string[], tasks?: BenchmarkTask[]): Promise<Array<{modelId: string; averageScore: number; averageDuration: number}>> {
        const comparisons: Array<{modelId: string; averageScore: number; averageDuration: number}> = [];

        for (const modelId of modelIds) {
            try {
                const {results} = await this.benchmark(modelId, tasks);
                const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
                const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
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
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), task.timeout))
            ]) as string;

            const duration = Date.now() - startTime;
            const success = !task.expectedPattern || response.includes(task.expectedPattern);
            const score = success ? Math.max(0, (1 - duration / task.timeout) * 100) : 0;

            return {taskId: task.id, success, duration, tokens: response.length / 4, score};
        } catch (error) {
            return {taskId: task.id, success: false, duration: Date.now() - startTime, tokens: 0, score: 0, error: errMsg(error)};
        }
    }
}
