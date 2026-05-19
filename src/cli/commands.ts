/**
 * REPL Commands for BOT7: Interactive debugging and tuning
 */

import type {Bot} from '../agent/index.js';
import type {NAR} from '../nar/index.js';
import {ExperimentRunner, formatExperimentResult, formatDiagnosticReport} from './ExperimentRunner.js';
import {termParser} from '../nar/terms/index.js';
import {TaskFormatter} from '../nar/utils/task-formatter.js';
import {createUnifiedTestRunner} from '../agent/scenarios/UnifiedTestRunner.js';

export interface CommandResult {
  success: boolean;
  output: string;
  data?: any;
}

export class REPLCommands {
  private experimentRunner: ExperimentRunner;
  private unifiedRunner: ReturnType<typeof createUnifiedTestRunner>;
  private depth = 3;
  private mode: 'auto' | 'chat' | 'reason' = 'auto';

  constructor(private bot: Bot, private nar: NAR) {
    this.experimentRunner = new ExperimentRunner(nar);
    this.unifiedRunner = createUnifiedTestRunner(nar);
  }

  async execute(input: string): Promise<CommandResult> {
    const trimmed = input.trim();
    
    if (trimmed === '/help' || trimmed === '.help') {
      return this.help();
    }
    
    if (trimmed.startsWith('/help ')) {
      return this.helpCommand(trimmed.slice(6).trim());
    }

    if (trimmed.startsWith('/depth')) {
      return this.setDepth(trimmed);
    }

    if (trimmed === '/beliefs') {
      return this.listBeliefs();
    }

    if (trimmed.startsWith('/beliefs ')) {
      return this.listBeliefs(trimmed.slice(8).trim() || undefined);
    }

    if (trimmed === '/concepts') {
      return this.listConcepts();
    }

    if (trimmed.startsWith('/trace ')) {
      return this.trace(trimmed.slice(7).trim());
    }

    if (trimmed.startsWith('/explain ')) {
      return this.explain(trimmed.slice(9).trim());
    }

    if (trimmed === '/mode') {
      return this.showMode();
    }

    if (trimmed.startsWith('/mode ')) {
      return this.setMode(trimmed.slice(6).trim());
    }

    if (trimmed === '/diagnostic') {
      return this.diagnostic();
    }

    if (trimmed.startsWith('/diagnostic ')) {
      return this.diagnostic(trimmed.slice(11).trim());
    }

    if (trimmed === '/run') {
      return this.run();
    }

    if (trimmed.startsWith('/run ')) {
      const parts = trimmed.slice(4).trim().split(/\s+/);
      const input = parts.slice(1).join(' ');
      const cycles = parseInt(parts[0] || '3') || 3;
      return this.experiment(input, cycles);
    }

    if (trimmed.startsWith('/experiment')) {
      const parts = trimmed.slice(10).trim().split(/\s+/);
      const input = parts.slice(1).join(' ');
      const cycles = parseInt(parts[0] || '3') || 3;
      return this.experiment(input, cycles);
    }

    if (trimmed === '/reset') {
      return this.reset();
    }

    if (trimmed === '/history') {
      return this.history();
    }

    if (trimmed.startsWith('/history ')) {
      return this.history(parseInt(trimmed.slice(9).trim()) || 10);
    }

    if (trimmed.startsWith('/scenario ')) {
      return this.runScenario(trimmed.slice(10).trim());
    }

    return {success: false, output: ''};
  }

  private help(): CommandResult {
    const helpText = `
SeNARS REPL Commands
====================
/depth [N]           Set reasoning depth (default: 3)
/beliefs [pattern]   List beliefs, optionally filtered
/concepts            Show concept graph summary
/trace <term>        Show derivation history for term
/explain <term>      Explain reasoning for term
/mode [mode]         Show/set mode (auto|chat|reason)
/diagnostic [input]  Run diagnostic analysis
/run [cycles] input  Run experiment with N cycles
/experiment [N] input Run experiment (alias for /run)
/reset               Reset memory and conversation
/history [N]         Show last N conversation turns
/help [command]      Show help for command
.quit/.exit          Exit REPL
`.trim();
    return {success: true, output: helpText};
  }

  private helpCommand(cmd: string): CommandResult {
    const docs: Record<string, string> = {
      '/depth': 'Set reasoning depth: /depth 5',
      '/beliefs': 'List beliefs: /beliefs [pattern] - filters by term pattern',
      '/concepts': 'Show concept summary with counts',
      '/trace': 'Trace derivations: /trace (cat --> animal)',
      '/explain': 'Explain reasoning: /explain (cat --> animal)',
      '/mode': 'Set mode: /mode auto|chat|reason',
      '/diagnostic': 'Run diagnostics: /diagnostic [input]',
      '/run': 'Run experiment: /run 5 <cat --> animal>.',
      '/reset': 'Clear memory and reset state',
      '/history': 'Show conversation history',
    };
    
    const doc = docs[cmd] || docs[cmd.startsWith('/') ? cmd.slice(1) : `/${cmd}`];
    return doc 
      ? {success: true, output: doc}
      : {success: false, output: `No help for: ${cmd}`};
  }

  private setDepth(input: string): CommandResult {
    const match = input.match(/\/depth\s+(\d+)/);
    if (match) {
      this.depth = parseInt(match[1]!);
      return {success: true, output: `Depth set to ${this.depth}`};
    }
    return {success: true, output: `Current depth: ${this.depth}`};
  }

  private listBeliefs(pattern?: string): CommandResult {
    const beliefs = this.nar.getBeliefs();
    const lines: string[] = [];
    
    for (const belief of beliefs) {
      const str = belief.term.toString();
      if (!pattern || str.includes(pattern)) {
        const tv = belief.truth ? ` :${TaskFormatter.formatTruth(belief.truth)}` : '';
        lines.push(`${str}${tv}`);
      }
    }
    
    return {
      success: true,
      output: lines.length > 0 ? lines.join('\n') : 'No beliefs found',
      data: {count: lines.length}
    };
  }

  private listConcepts(): CommandResult {
    const concepts = this.nar.memory.listConcepts();
    const lines = concepts.map(c =>
      `${c.term.toString()} (p:${c.priority.toFixed(2)}, beliefs:${c.beliefBag.size})`
    );
    
    return {
      success: true,
      output: lines.length > 0 ? lines.join('\n') : 'No concepts',
      data: {count: concepts.length}
    };
  }

  private trace(term: string): CommandResult {
    const history = this.experimentRunner.getTrace(term);
    return {
      success: true,
      output: history.length > 0 
        ? `Trace for ${term}:\n${history.join('\n')}`
        : `No trace found for ${term}`
    };
  }

  private explain(term: string): CommandResult {
    const explanation = this.experimentRunner.explain(term);
    return {success: true, output: explanation};
  }

  private showMode(): CommandResult {
    return {success: true, output: `Current mode: ${this.mode}`};
  }

  private setMode(mode: string): CommandResult {
    if (['auto', 'chat', 'reason'].includes(mode)) {
      this.mode = mode as any;
      return {success: true, output: `Mode set to ${mode}`};
    }
    return {success: false, output: 'Invalid mode. Use: auto, chat, or reason'};
  }

  private async diagnostic(input?: string): Promise<CommandResult> {
    const testInput = input || '<dog --> animal>.';
    const report = await this.experimentRunner.runDiagnostic(testInput);
    return {
      success: true,
      output: formatDiagnosticReport(report)
    };
  }

  private async experiment(input: string, cycles: number): Promise<CommandResult> {
    if (!input) {
      return {success: false, output: 'Usage: /run [cycles] <input>'};
    }
    
    await this.nar.clearMemory();
    const result = await this.experimentRunner.runExperiment(input, cycles);
    return {
      success: true,
      output: formatExperimentResult(result, true)
    };
  }

  private run(): CommandResult {
    return {success: false, output: 'Usage: /run [cycles] <input>'};
  }

  private reset(): CommandResult {
    this.nar.clearMemory();
    return {success: true, output: 'Memory reset'};
  }

  private history(count = 10): CommandResult {
    const state = this.bot.stateManager.getOrCreate('cli-user');
    const messages = (state as any).messages || [];
    const recent = messages.slice(-count);
    
    if (recent.length === 0) {
      return {success: true, output: 'No conversation history'};
    }
    
    const lines = recent.map((m: any, i: number) =>
      `${i % 2 === 0 ? 'You' : 'Bot'}: ${m.text || m.message || ''}`
    );
    
    return {success: true, output: lines.join('\n')};
  }

  private async runScenario(scenarioId: string): Promise<CommandResult> {
    try {
      const result = await this.unifiedRunner.run({
        id: scenarioId,
        name: scenarioId,
        description: `Ad-hoc test: ${scenarioId}`,
        category: 'test' as const,
        steps: [{ input: scenarioId, type: 'belief' as const }],
        type: 'single' as const
      });
      return {
        success: result.passed,
        output: `Test ${result.passed ? 'PASSED' : 'FAILED'} (score: ${(result.score * 100).toFixed(1)}%)`
      };
    } catch (error) {
      return {
        success: false,
        output: `Test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export function createREPLCommands(bot: Bot, nar: NAR): REPLCommands {
  return new REPLCommands(bot, nar);
}
