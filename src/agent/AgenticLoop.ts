import type {IOMessage} from '../io/types.js';
import {MessageQueue} from './MessageQueue.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {NAR} from '../nar/nar.js';
import {Agent} from './Agent.js';

export interface AgenticLoopConfig {
    maxInputTurns: number;
    maxWakeTurns: number;
    sleepIntervalMs: number;
    wakeupIntervalMs: number;
    reasoningStepsPerWake?: number;
    enableLMRules?: boolean;
    backgroundReasoning?: boolean;
}

const DEFAULT_CONFIG: Required<AgenticLoopConfig> = {
    maxInputTurns: 50,
    maxWakeTurns: 3,
    sleepIntervalMs: 1000,
    wakeupIntervalMs: 60000,
    reasoningStepsPerWake: 5,
    enableLMRules: true,
    backgroundReasoning: true,
};

export class AgenticLoop {
    private readonly config: Required<AgenticLoopConfig>;
    private readonly queue: MessageQueue;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly agent?: Agent;
    private readonly nar?: NAR;
    private running = false;
    private idleCounter = 0;
    private nextWakeAt = 0;
    private currentTurn = 0;
    private onMessage?: (msg: IOMessage) => Promise<void>;

    constructor(
        agent: Agent | NAR,
        episodicMemory?: EpisodicMemory,
        config: AgenticLoopConfig = DEFAULT_CONFIG
    ) {
        this.agent = agent instanceof Agent ? agent : undefined;
        this.nar = agent instanceof Agent ? agent.getNAR() : agent;
        this.config = {...DEFAULT_CONFIG, ...config};
        this.queue = new MessageQueue();
        this.episodicMemory = episodicMemory;
    }

    setMessageHandler(handler: (msg: IOMessage) => Promise<void>): void {
        this.onMessage = handler;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.nextWakeAt = Date.now() + this.config.wakeupIntervalMs;
        this.runLoop();
    }

    stop(): void {
        this.running = false;
    }

    pushMessage(message: IOMessage): void {
        this.queue.push(message);
    }

    getStats(): { turn: number; idleCounter: number; queueSize: number } {
        return {
            turn: this.currentTurn,
            idleCounter: this.idleCounter,
            queueSize: this.queue.size(),
        };
    }

    private async runLoop(): Promise<void> {
        while (this.running) {
            const messages = this.queue.drain();

            if (messages.length > 0) {
                this.idleCounter = 0;
                await this.processMessages(messages);
            } else {
                this.idleCounter++;
            }

            const now = Date.now();
            if (this.idleCounter >= this.config.maxInputTurns && now >= this.nextWakeAt) {
                await this.wakeupSequence();
                this.nextWakeAt = now + this.config.wakeupIntervalMs;
                this.idleCounter = 0;
            }

            await this.sleep(this.config.sleepIntervalMs);
            this.currentTurn++;
        }
    }

    private async processMessages(messages: IOMessage[]): Promise<void> {
        for (const message of messages) {
            if (this.onMessage) {
                await this.onMessage(message);
            }

            if (this.episodicMemory) {
                await this.episodicMemory.log('input', message.text, {
                    channel: message.source,
                    user: message.sender,
                });
            }
        }
    }

    private async wakeupSequence(): Promise<void> {
        const nar = this.nar;
        if (!nar) return;

        if (this.config.backgroundReasoning) {
            await this.backgroundReasoning(nar);
        }

        try {
            if (this.config.enableLMRules && nar.enrichMemoryWithLM) {
                await nar.enrichMemoryWithLM();
            }
        } catch {}

        try {
            if (nar.memory?.consolidate) {
                nar.memory.consolidate();
            }
        } catch {}

        try {
            const selfAnalyzer = nar.getSelfAnalyzer?.();
            if (selfAnalyzer && typeof (selfAnalyzer as any).analyzeReasoningGaps === 'function') {
                await (selfAnalyzer as any).analyzeReasoningGaps();
            }
        } catch {}

        if (this.episodicMemory) {
            try {
                const recentEpisodes = await this.episodicMemory.getEpisodes({ limit: 100 });
                if (recentEpisodes.length > 0) {
                    const errorCount = recentEpisodes.filter(e => e.type === 'error').length;
                    if (errorCount > 10) {
                        await this.episodicMemory.log('input', 'high_error_rate', {
                            errorCount,
                            totalEpisodes: recentEpisodes.length,
                            turn: this.currentTurn,
                        });
                    }
                }
            } catch {}
        }

        if (this.episodicMemory) {
            try {
                await this.episodicMemory.log('input', 'wakeup', {
                    turn: this.currentTurn,
                    idleCounter: this.idleCounter,
                    concepts: nar.getStatistics()?.totalConcepts ?? 0,
                    tasks: nar.getStatistics()?.totalTasks ?? 0,
                });
            } catch {}
        }
    }

    private async backgroundReasoning(nar: NAR): Promise<void> {
        const steps = this.config.reasoningStepsPerWake;

        try {
            await nar.run(steps);
        } catch {}

        try {
            const questions = nar.getQuestions?.();
            if (questions && questions.length > 0) {
                for (const q of questions.slice(0, 3)) {
                    await nar.run(steps);
                }
            }
        } catch {}

        try {
            const goals = nar.getGoals?.();
            if (goals && goals.length > 0) {
                for (const g of goals.slice(0, 2)) {
                    await nar.run(steps);
                }
            }
        } catch {}
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}