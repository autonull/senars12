import type { CognitiveEvent } from '@senars/core';
import { parseMeTTa } from '../parser/runtime.js';
import type { MeTTaRuntime } from '../runtime/builder.js';
import { MettaCommandParser } from './MettaCommandParser.js';
import type { MettaHistory } from './MettaHistory.js';
import type { MettaPromptBuilder } from './MettaPromptBuilder.js';
import type { MettaSkills } from './MettaSkills.js';
import type { MettaLoopConfig, SkillFeedback } from './MettaTypes.js';
import { DEFAULT_LOOP_CONFIG } from './MettaTypes.js';

export class MettaLoop {
  #runtime: MeTTaRuntime;
  #skills: MettaSkills;
  #history: MettaHistory;
  #promptBuilder: MettaPromptBuilder;
  #commandParser = new MettaCommandParser();
  #config: MettaLoopConfig;
  #running = false;
  #idleSince = 0;
  #loopsSinceInput = 0;
  #knownAtomKeys = new Set<string>();
  #messageQueue: string[] = [];
  #emitCognitive: (event: CognitiveEvent) => void;
  #correlationId = '';

  constructor(
    runtime: MeTTaRuntime,
    skills: MettaSkills,
    history: MettaHistory,
    promptBuilder: MettaPromptBuilder,
    emitCognitive: (event: CognitiveEvent) => void,
    config: Partial<MettaLoopConfig> = {}
  ) {
    this.#runtime = runtime;
    this.#skills = skills;
    this.#history = history;
    this.#promptBuilder = promptBuilder;
    this.#emitCognitive = emitCognitive;
    this.#config = { ...DEFAULT_LOOP_CONFIG, ...config };
  }

  enqueueMessage(msg: string, correlationId: string): void {
    this.#messageQueue.push(msg);
    this.#correlationId = correlationId;
    this.#loopsSinceInput = 0;
  }

  async run(): Promise<void> {
    this.#running = true;

    while (this.#running) {
      const msg = this.#dequeueMessage();
      const hasInput = msg !== null;

      if (hasInput) {
        this.#loopsSinceInput = 0;
      }

      if (this.#shouldRunCycle(hasInput)) {
        await this.#runCycle(msg);
      }

      if (this.#loopsSinceInput >= this.#config.maxWakeLoops) {
        await this.#sleepUntilWakeup();
      } else {
        await new Promise((r) => setTimeout(r, this.#config.sleepInterval * 1000));
        if (hasInput) this.#loopsSinceInput++;
      }
    }
  }

  async #runCycle(msg: string | null): Promise<void> {
    const cycleStart = Date.now();
    const correlationId = this.#correlationId || crypto.randomUUID();

    if (msg) {
      this.#emitCognitive({
        engine: 'metta',
        type: 'input',
        term: msg,
        source: 'transport',
        timestamp: Date.now(),
        correlationId,
      });
    }

    const prompt = this.#promptBuilder.build({
      systemPrompt: this.#promptBuilder.getSystemPrompt(),
      skills: this.#skills
        .getAllFeedback()
        .map((f) => `- ${f.skill}: ${f.lastResult}`)
        .join('\n'),
      skillResults: this.#skills.getRecentResults(this.#config.skillResultsChars),
      history: this.#history.toPromptLines(20),
      time: new Date().toISOString(),
      maxSkillResultsChars: this.#config.skillResultsChars,
    });

    const llmResponse = msg ? await this.#simulateLLMResponse(msg) : '';
    if (llmResponse) {
      const commands = this.#commandParser.parse(llmResponse);
      for (const cmd of commands) {
        try {
          await this.#executeCommand(cmd);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          this.#history.setErrorFeedback(errMsg);
        }
      }
    }

    const cycleDuration = Date.now() - cycleStart;
    this.#emitCognitive({
      engine: 'metta',
      type: 'cycle',
      cycle: cycleDuration,
      derived: llmResponse ? 1 : 0,
      timestamp: Date.now(),
      correlationId,
    });

    if (llmResponse) {
      const execResult = this.#skills.getRecentResults(1);
      this.#emitCognitive({
        engine: 'metta',
        type: 'skill:executed',
        skill: 'llm',
        result: execResult,
        durationMs: cycleDuration,
        timestamp: Date.now(),
        correlationId,
      });
    }
  }

  async #executeCommand(cmd: { command: string; args: string[]; raw: string }): Promise<void> {
    switch (cmd.command) {
      case 'send': {
        const target = cmd.args[0]?.replace(/^"|"$/g, '') ?? '';
        if (target)
          this.#emitCognitive({
            engine: 'metta',
            type: 'derivation',
            term: `SEND: ${target}`,
            confidence: 1,
            timestamp: Date.now(),
            correlationId: this.#correlationId,
          });
        break;
      }
      case 'remember': {
        const atomStr = cmd.args[0]?.replace(/^"|"$/g, '') ?? '';
        if (atomStr) {
          const atom = parseMeTTa(atomStr);
          this.#emitCognitive({
            engine: 'metta',
            type: 'derivation',
            term: atomStr,
            confidence: 1,
            timestamp: Date.now(),
            correlationId: this.#correlationId,
          });
        }
        break;
      }
      case 'metta': {
        const sexpr = cmd.args[0]?.replace(/^"|"$/g, '') ?? '';
        if (sexpr) {
          const atom = parseMeTTa(sexpr);
          this.#emitCognitive({
            engine: 'metta',
            type: 'derivation',
            term: sexpr,
            confidence: 1,
            timestamp: Date.now(),
            correlationId: this.#correlationId,
          });
        }
        break;
      }
      case 'episodes': {
        break;
      }
      default:
        break;
    }
  }

  async #simulateLLMResponse(_input: string): Promise<string> {
    return `remember "${_input.replace(/"/g, '\\"')}"`;
  }

  #dequeueMessage(): string | null {
    return this.#messageQueue.shift() ?? null;
  }

  #shouldRunCycle(hasInput: boolean): boolean {
    return hasInput || this.#loopsSinceInput < this.#config.maxWakeLoops;
  }

  async #sleepUntilWakeup(): Promise<void> {
    this.#idleSince = Date.now();
    while (this.#running) {
      const elapsed = (Date.now() - this.#idleSince) / 1000;
      if (elapsed >= this.#config.wakeupInterval) break;
      await new Promise((r) =>
        setTimeout(r, Math.min(1000, (this.#config.wakeupInterval - elapsed) * 1000))
      );
    }
    this.#loopsSinceInput = 0;
    this.#idleSince = 0;
  }

  stop(): void {
    this.#running = false;
  }

  configure(config: Partial<MettaLoopConfig>): void {
    this.#config = { ...this.#config, ...config };
  }

  get config(): Readonly<MettaLoopConfig> {
    return this.#config;
  }

  get isRunning(): boolean {
    return this.#running;
  }
}
