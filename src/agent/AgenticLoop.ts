import type {IOMessage} from '../io/types.js';
import {MessageQueue} from './MessageQueue.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {Agent} from './Agent.js';

export interface AgenticLoopConfig {
    maxInputTurns: number;
    maxWakeTurns: number;
    sleepIntervalMs: number;
    wakeupIntervalMs: number;
    reasoningStepsPerWake?: number;
    enableLMRules?: boolean;
}

const DEFAULT_CONFIG: Required<AgenticLoopConfig> = {
    maxInputTurns: 50,
    maxWakeTurns: 3,
    sleepIntervalMs: 1000,
    wakeupIntervalMs: 60000,
    reasoningStepsPerWake: 5,
    enableLMRules: true,
};

export class AgenticLoop {
    private readonly config: Required<AgenticLoopConfig>;
    private readonly queue: MessageQueue;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly agent: Agent;
    private running = false;
    private idleCounter = 0;
    private nextWakeAt = 0;
    private currentTurn = 0;
    private onMessage?: (msg: IOMessage) => Promise<void>;

    constructor(
        agent: Agent,
        episodicMemory?: EpisodicMemory,
        config: AgenticLoopConfig = DEFAULT_CONFIG
    ) {
        this.agent = agent;
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
    const nar = this.agent.getNAR();

    // 1. Run reasoning steps
    try {
      await nar.run(this.config.reasoningStepsPerWake);
    } catch {
    }

    // 2. LM enrichment (if enabled)
    try {
      if (nar.enrichMemoryWithLM && this.config.enableLMRules) {
        await nar.enrichMemoryWithLM();
      }
    } catch {
    }

    // 3. Memory consolidation
    try {
      nar.memory.consolidate();
    } catch {
    }

    // 4. Self-analysis for reasoning gaps (use agent's SelfAnalyzer)
    try {
      const selfAnalyzer = nar.getSelfAnalyzer();
      if (selfAnalyzer && 'analyzeReasoningGaps' in selfAnalyzer) {
        await (selfAnalyzer as any).analyzeReasoningGaps();
      }
    } catch {
    }

    // 5. Episodic memory pattern check
    if (this.episodicMemory) {
      try {
        const recentEpisodes = await this.episodicMemory.getEpisodes({
          limit: 100
        });
        // Check for patterns or repeated issues
        if (recentEpisodes.length > 0) {
          const errorCount = recentEpisodes.filter(e => e.type === 'error').length;
          if (errorCount > 10) {
            // Log high error rate
            await this.episodicMemory.log('input', 'high_error_rate', {
              errorCount,
              totalEpisodes: recentEpisodes.length,
              turn: this.currentTurn
            });
          }
        }
      } catch {
      }
    }

    // 6. Check for pending benchmarks/experiments (if available via agent)
    try {
      const narAny = nar as any;
      if (narAny.scenarioRunner) {
        // Check for pending scenarios
        const pending = await (narAny.scenarioRunner as any).getPendingScenarios?.();
        if (pending?.length > 0) {
          // Could trigger scenario execution
        }
      }
      if (narAny.experimentRunner) {
        // Check for pending experiments
        const pending = await (narAny.experimentRunner as any).getPendingExperiments?.();
        if (pending?.length > 0) {
          // Could trigger experiment execution
        }
      }
    } catch {
    }

    // 7. Log wakeup activity to episodic memory
    if (this.episodicMemory) {
      try {
        await this.episodicMemory.log('input', 'wakeup', {
          turn: this.currentTurn,
          idleCounter: this.idleCounter,
          concepts: nar.getStatistics()?.totalConcepts ?? 0,
          tasks: nar.getStatistics()?.totalTasks ?? 0
        });
      } catch {
      }
    }
  }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}