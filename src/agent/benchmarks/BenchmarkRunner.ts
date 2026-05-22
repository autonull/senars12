import type {NAR} from '../../nar/nar.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import {AIAgent} from '../AIAgent.js';
import type {ConversationState} from '../ConversationState.js';
import type {Scenario} from '../scenarios/types.js';
import type {BotConfig, Capabilities} from '../BotContext.js';
import {SeNARSFactory} from '../../nar/index.js';
import {createSeNARSRegistry} from '../../nar/lm/providers.js';
import {ScenarioRunner} from '../scenarios/ScenarioRunner.js';
import {allSuites, getSuiteById} from './index.js';

export interface BenchmarkConfig {
  nar: NAR;
  agent: AIAgent;
  conversation: ConversationState;
  suites?: string[];
  timeout?: number;
  maxRetries?: number;
}

export interface BenchmarkResult {
  suiteId: string;
  suiteName: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  score: number;
  duration: number;
  results: ScenarioResult[];
  errors: string[];
}

export interface ScenarioResult {
  scenarioId: string;
  passed: boolean;
  score: number;
  duration: number;
  error?: string;
}

export class BenchmarkRunner {
  private readonly nar: NAR;
  private readonly agent: AIAgent;
  private readonly conversation: ConversationState;
  private readonly suites: string[];
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly scenarioRunner: ScenarioRunner;

  constructor(config: BenchmarkConfig) {
    this.nar = config.nar;
    this.agent = config.agent;
    this.conversation = config.conversation;
    this.suites = config.suites ?? allSuites.map(s => s.id);
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 1;
    this.scenarioRunner = new ScenarioRunner(this.nar);
  }

  static async create(config: {
    suites?: string[];
    timeout?: number;
    maxRetries?: number;
    provider?: 'anthropic' | 'ollama' | 'transformers';
    model?: string;
  } = {}): Promise<{runner: BenchmarkRunner; cleanup: () => void}> {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    
    const capabilities: Capabilities = {
      hasLM: true,
      hasSeNARS: true,
      hasStreaming: false,
      hasTools: true,
      hasMemory: true,
      mode: 'full',
    };

    const botConfig: BotConfig = {
      reasoning: {
        autoTrigger: true,
        triggerThreshold: 0.5,
        triggerCooldown: 3,
        maxStepsPerTrigger: 5,
        backgroundReasoning: false,
        backgroundIntervalMs: 60000,
        lmDriven: true,
      },
      streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
      conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
      directives: {builtIn: true},
      nlParsers: {builtIn: true},
      classifier: {},
      lmRules: {enabled: true, rules: []},
      tui: {typingIndicator: false, colors: true, compactMode: false, statusBar: true},
      prompts: {},
    };

    const agent = new AIAgent({
      nar,
      provider: config.provider ?? 'transformers',
      model: config.model,
      config: botConfig,
      capabilities,
    });

    const conversation = new (await import('../ConversationState.js')).ConversationState(botConfig);

    const runner = new BenchmarkRunner({
      nar,
      agent,
      conversation,
      suites: config.suites,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });

    return {
      runner,
      cleanup: () => {
      },
    };
  }

  async runAllSuites(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const suiteId of this.suites) {
      const suite = getSuiteById(suiteId);
      if (!suite) continue;

      const result = await this.runSuite(suite);
      results.push(result);
    }

    return results;
  }

  async runSuite(suite: {id: string; name: string; scenarios: Scenario[]}): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const results: ScenarioResult[] = [];
    const errors: string[] = [];
    let passedCount = 0;

    for (const scenario of suite.scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
      
      if (result.passed) {
        passedCount++;
      } else {
        if (result.error) {
          errors.push(`${scenario.id}: ${result.error}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);

    return {
      suiteId: suite.id,
      suiteName: suite.name,
      totalScenarios: suite.scenarios.length,
      passedScenarios: passedCount,
      failedScenarios: suite.scenarios.length - passedCount,
      score: totalScore / Math.max(1, suite.scenarios.length),
      duration,
      results,
      errors,
    };
  }

  private async runScenario(scenario: Scenario, retryCount = 0): Promise<ScenarioResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.scenarioRunner.run(scenario);
      
      return {
        scenarioId: scenario.id || `scenario-${startTime}`,
        passed: result.passed,
        score: result.score,
        duration: result.duration,
        error: result.error,
      };
    } catch (error) {
      if (retryCount < (this.maxRetries ?? 0)) {
        return this.runScenario(scenario, retryCount + 1);
      }
      
      return {
        scenarioId: scenario.id || `scenario-${startTime}`,
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testWithAIAgent(input: string, expectedResponse?: string): Promise<{response: string; passed: boolean}> {
    const context = {
      sender: 'benchmark',
      connectionType: 'cli' as const,
      conversation: this.conversation,
    };

    const response = await this.agent.chat(input, context);
    
    let passed = true;
    if (expectedResponse) {
      passed = response.toLowerCase().includes(expectedResponse.toLowerCase());
    }

    return {response, passed};
  }

  getSummary(results: BenchmarkResult[]): string {
    const parts: string[] = [];
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = totalScore / Math.max(1, results.length);
    const totalPassed = results.reduce((sum, r) => sum + r.passedScenarios, 0);
    const totalScenarios = results.reduce((sum, r) => sum + r.totalScenarios, 0);

    parts.push('## Benchmark Summary');
    parts.push(`- Suites Run: ${results.length}`);
    parts.push(`- Average Score: ${(avgScore * 100).toFixed(1)}%`);
    parts.push(`- Total Passed: ${totalPassed}/${totalScenarios}`);
    parts.push('');

    parts.push('## Suite Results');
    for (const result of results) {
      parts.push(`- ${result.suiteName}: ${result.passedScenarios}/${result.totalScenarios} (${(result.score * 100).toFixed(1)}%)`);
    }

    return parts.join('\n');
  }
}
