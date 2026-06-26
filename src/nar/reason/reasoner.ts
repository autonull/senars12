import type {CoreConfig, Task} from '../types';
import type {Memory} from '../memory';
import type {RuleProcessor} from '../rules';
import type {Strategy} from './strategy.js';
import {type InferenceConfig, InferenceController} from './inference-controller.js';
import {DefaultDerivation, PrioritySampling} from '../strategies';

export interface ReasonerConfig extends Pick<CoreConfig, 'cpuThrottleMs' | 'maxDerivationDepth' | 'maxDerivationsPerStep'> {
    enableCircularDetection?: boolean;
    enableTraceCollection?: boolean;
    singlePremiseLMRules?: boolean;
}

export interface ReasoningTrace {
    taskId: string;
    premises: Task[];
    result: Task;
    timestamp: number;
    derivationDepth: number;
}

export class Reasoner {
    private derivationCount = 0;
    private readonly traces: ReasoningTrace[] = [];
    private readonly inferenceController: InferenceController;

    constructor(
        private readonly memory: Memory,
        private readonly processor: RuleProcessor,
        private readonly strategy: Strategy,
        private readonly config: ReasonerConfig
    ) {
        const inferenceConfig: InferenceConfig = {
            maxDerivationsPerStep: config.maxDerivationsPerStep ?? 1000,
            maxDerivationDepth: config.maxDerivationDepth ?? 10,
            enableCircularDetection: config.enableCircularDetection ?? false,
            enableTraceCollection: config.enableTraceCollection ?? false,
            cpuThrottleMs: config.cpuThrottleMs ?? 0,
            singlePremiseLMRules: config.singlePremiseLMRules ?? true,
            maxLMRulesPerStep: 13,
            enableLMRules: true
        };
        this.inferenceController = new InferenceController(
            memory, processor, new PrioritySampling(), strategy, new DefaultDerivation(), inferenceConfig
        );
    }

    async step(_timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
        const results = await this.inferenceController.step(_timeoutMs, maxResults, signal);
        this.derivationCount += results.length;
        return results;
    }

    async* run(_timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
        const maxResultsRef = {count: 0};
        for await (const task of this.inferenceController.run(maxResults, signal)) {
            yield task;
            maxResultsRef.count++;
            if (maxResultsRef.count >= maxResults) break;
        }
        this.derivationCount += maxResultsRef.count;
    }

    getTraces(): ReasoningTrace[] {
        return [...this.traces];
    }

    clearTraces(): void {
        this.traces.splice(0, this.traces.length);
    }

    getDerivationCount(): number {
        return this.derivationCount;
    }

    resetCircularDetection(): void {
        this.inferenceController.resetCircularDetection();
    }
}
