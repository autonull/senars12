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

  private getEpisodicMemory() {
    return (this.bot as any).episodicMemory || (this.nar as any).episodicMemory;
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

    if (trimmed.startsWith('/budget')) {
      return await this.budget(trimmed.slice(7).trim());
    }

    if (trimmed.startsWith('/focus ')) {
      return this.focus(trimmed.slice(7).trim());
    }

    if (trimmed.startsWith('/forget ')) {
      return this.forget(trimmed.slice(8).trim());
    }

    if (trimmed === '/context') {
      return this.context();
    }

    if (trimmed.startsWith('/export')) {
      return await this.export(trimmed.slice(7).trim());
    }

    if (trimmed.startsWith('/import ')) {
      return await this.import(trimmed.slice(8).trim());
    }

    if (trimmed === '/self.status') {
      return await this.selfStatus();
    }

    if (trimmed === '/self.analyze') {
      return await this.selfAnalyze();
    }

    if (trimmed.startsWith('/debug')) {
      return this.debug(trimmed.slice(6).trim());
    }

    if (trimmed.startsWith('/rules')) {
      return this.rules(trimmed.slice(6).trim());
    }

    if (trimmed.startsWith('/lm-rules')) {
      return this.lmRules(trimmed.slice(9).trim());
    }

    if (trimmed.startsWith('/benchmark')) {
      return this.benchmark(trimmed.slice(10).trim());
    }

    if (trimmed.startsWith('/adversarial')) {
      return this.adversarial(trimmed.slice(12).trim());
    }

    if (trimmed === '/episodes') {
      return this.episodes(10);
    }

    if (trimmed.startsWith('/episodes ')) {
      return this.episodes(parseInt(trimmed.slice(9).trim()) || 10);
    }

    if (trimmed === '/episodes.clear') {
      return this.episodesClear();
    }

    if (trimmed === '/episodes.prune') {
      return this.episodesPrune();
    }

    if (trimmed.startsWith('/pin ')) {
      return this.pin(trimmed.slice(5).trim());
    }

    if (trimmed === '/pinned') {
      return this.pinned();
    }

  if (trimmed.startsWith('/unpin')) {
    return this.unpin(trimmed.slice(7).trim());
  }

  if (trimmed === '/identity') {
    return this.identity();
  }

  if (trimmed.startsWith('/identity ')) {
    return this.identityDetail(trimmed.slice(9).trim());
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
/budget [preset]     Show/set cognitive budget (chat|reasoning|deep|balanced)
/focus <topic>       Boost attention for topic
/forget <pattern>    Remove beliefs matching pattern
/context             Show attention/focus state
/export [file]       Export beliefs to file
/import <file>       Import beliefs from file
/self.status         Show cognitive state
/self.analyze        Run self-analysis
/debug on|off        Toggle Narsese debug output
/rules [list]        List NAL rules
/lm-rules [list]     List LM rules
/benchmark           Run performance benchmark
/adversarial [scn]   Run adversarial test (loop|explosion|oscillation)
/scenario <id>       Run test scenario
/episodes [n] Show last n episodic memory entries (default: 10)
/episodes.clear Clear all episodic memory
/episodes.prune Remove old episodes based on retention policy
/pin <key> <value> Store in working memory
/pinned List all pinned items
/unpin [key] Clear working memory or unpin specific key
/identity Show identity resolution info
/identity <canonicalId> Show details for identity
/help [command] Show help for command
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

  private async budget(preset: string): Promise<CommandResult> {
    const presets = ['chat', 'reasoning', 'deep', 'balanced'];
    if (!preset) return {success: true, output: `Current budget presets: ${presets.join(', ')}`};
    if (!presets.includes(preset)) return {success: false, output: `Invalid preset. Use: ${presets.join(', ')}`};
    const mod = await import('../nar/config/budget.js');
    const budget = mod.BUDGET_PRESETS[preset]!;
    return {success: true, output: `Budget "${preset}": NAL=${budget.maxNALSteps}, LM=${budget.maxLMCalls}, depth=${budget.maxDerivationDepth}, memory=${budget.maxMemoryOps}`};
  }

  private focus(topic: string): CommandResult {
    if (!topic) return {success: false, output: 'Usage: /focus <topic>'};
    this.nar.memory.getFocus().boostTopic(topic, 2.0, 50);
    return {success: true, output: `Focus boosted for "${topic}" (2x, 50 cycles)`};
  }

  private forget(pattern: string): CommandResult {
    if (!pattern) return {success: false, output: 'Usage: /forget <pattern>'};
    let count = 0;
    for (const concept of this.nar.listConcepts()) {
      if (concept.term.toString().toLowerCase().includes(pattern.toLowerCase())) {
        this.nar.memory.removeConcept(concept.term);
        count++;
      }
    }
    return {success: true, output: `Removed ${count} concept(s) matching "${pattern}"`};
  }

  private context(): CommandResult {
    const stats = this.nar.getStatistics();
    const report = this.nar.attentionReport();
    const focus = this.nar.memory.getFocusConcepts();
    const lines: string[] = [
      `Concepts: ${stats.totalConcepts}, Pressure: ${(stats.memoryPressure * 100).toFixed(0)}%`,
      `Active concepts: ${report.concepts.slice(0, 5).map(c => `${c.term} (${(c.priority * 100).toFixed(0)}%)`).join(', ')}`,
      `Focus concepts: ${focus.slice(0, 5).map(c => c.term.toString()).join(', ')}`,
    ];
    return {success: true, output: lines.join('\n')};
  }

  private async export(file: string): Promise<CommandResult> {
    const beliefs = this.nar.getBeliefs();
    const output = beliefs.map(b => {
      const tv = b.truth ? ` :${b.truth.f.toFixed(1)}:${b.truth.c.toFixed(1)}` : '';
      return `${b.term.toString()}${tv}`;
    }).join('\n');
    if (file) {
      const fs = await import('fs');
      fs.writeFileSync(file, output);
      return {success: true, output: `Exported ${beliefs.length} beliefs to ${file}`};
    }
    return {success: true, output: output || 'No beliefs to export'};
  }

  private async import(file: string): Promise<CommandResult> {
    if (!file) return {success: false, output: 'Usage: /import <file>'};
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
      let count = 0;
      for (const line of lines) {
        try {
          this.nar.believe(line.trim());
          count++;
        } catch { /* skip invalid */ }
      }
      return {success: true, output: `Imported ${count} beliefs from ${file}`};
    } catch (error) {
      return {success: false, output: `Import error: ${error instanceof Error ? error.message : String(error)}`};
    }
  }

  private async selfStatus(): Promise<CommandResult> {
    const {Observer} = await import('../nar/cognitive/index.js');
    const observer = new Observer();
    return {success: true, output: observer.reportState(this.nar)};
  }

  private async selfAnalyze(): Promise<CommandResult> {
    const {Observer} = await import('../nar/cognitive/index.js');
    const observer = new Observer();
    const report = observer.check(this.nar);
    const lines = [
      `State: ${report.state}`,
      `Action: ${report.action}`,
      `Concepts: ${report.totalConcepts}`,
      `Contradictions: ${report.contradictions}`,
      `Memory pressure: ${(report.memoryPressure * 100).toFixed(0)}%`,
      `Derivations/sec: ${report.derivationsPerSecond.toFixed(2)}`,
      report.suggestion ? `Suggestion: ${report.suggestion}` : '',
    ].filter(Boolean);
    return {success: true, output: lines.join('\n')};
  }

  private debug(arg: string): CommandResult {
    if (!arg) return {success: true, output: 'Debug mode: /debug on|off'};
    const enabled = arg.toLowerCase() === 'on';
    return {success: true, output: `Narsese debug output ${enabled ? 'enabled' : 'disabled'}`};
  }

  private rules(arg: string): CommandResult {
    const nalRules = ['deduction', 'induction', 'abduction', 'revision', 'analogy', 'comparison', 'contraction', 'exemplification', 'conversion', 'contraposition', 'negation', 'conditional', 'temporal'];
    if (!arg || arg === 'list') return {success: true, output: `NAL rules: ${nalRules.join(', ')}`};
    return {success: true, output: `Rule management: ${arg}`};
  }

  private lmRules(arg: string): CommandResult {
    const rules = ['lm-narsese-translation', 'lm-belief-revision', 'lm-goal-decomposition', 'lm-hypothesis-generation', 'lm-explanation-generation', 'lm-analogical-reasoning', 'lm-meta-reasoning', 'lm-uncertainty-calibration', 'lm-schema-induction', 'lm-temporal-causal', 'lm-variable-grounding', 'lm-concept-elaboration', 'lm-interactive-clarification'];
    if (!arg || arg === 'list') return {success: true, output: `LM rules: ${rules.join(', ')}`};
    return {success: true, output: `LM rule management: ${arg}`};
  }

  private async benchmark(arg: string): Promise<CommandResult> {
    const start = Date.now();
    await this.nar.run(100);
    const elapsed = Date.now() - start;
    const stats = this.nar.getStatistics();
    return {success: true, output: `Benchmark: ${elapsed}ms, ${stats.totalConcepts} concepts, ${stats.totalTasks} tasks`};
  }

  private async adversarial(arg: string): Promise<CommandResult> {
    const scenario = arg || 'loop';
    const scenarios: Record<string, string[]> = {
      loop: ['(A --> B).', '(B --> C).', '(C --> A).'],
      explosion: Array(100).fill(0).map((_, i) => `(<x${i} --> y${i}>. :0.5:0.5)`),
      oscillation: ['(A --> B). :1.0:0.9', '(A --> B). :0.0:0.9'],
    };
    const steps = scenarios[scenario] ?? scenarios.loop!;
    for (const step of steps) {
      try { await this.nar.believe(step); } catch { /* skip */ }
    }
    await this.nar.run(10);
    const stats = this.nar.getStatistics();
    return {success: true, output: `Adversarial "${scenario}": ${stats.totalConcepts} concepts, ${stats.totalTasks} tasks after injection`};
  }

  private async episodes(limit: number): Promise<CommandResult> {
    const mem = this.getEpisodicMemory();
    if (!mem) return {success: false, output: 'EpisodicMemory not available'};
    try {
      const episodes = await mem.getEpisodes({limit});
      if (episodes.length === 0) return {success: true, output: 'No episodes found'};
      const lines = episodes.map((e: any) => {
        const time = new Date(e.timestamp).toISOString();
        const meta = Object.keys(e.metadata).length ? ` [${JSON.stringify(e.metadata)}]` : '';
        return `[${time}] ${e.type}: ${e.content}${meta}`;
      });
      return {success: true, output: `Episodic Memory (${episodes.length} entries):\n${lines.join('\n')}`};
    } catch (error) {
      return {success: false, output: `Error: ${error instanceof Error ? error.message : String(error)}`};
    }
  }

  private async episodesClear(): Promise<CommandResult> {
    const mem = (this.nar as any).episodicMemory;
    if (!mem) return {success: false, output: 'EpisodicMemory not available'};
    try {
      await mem.clear();
      return {success: true, output: 'Episodic memory cleared'};
    } catch (error) {
      return {success: false, output: `Error: ${error instanceof Error ? error.message : String(error)}`};
    }
  }

  private async episodesPrune(): Promise<CommandResult> {
    const mem = (this.nar as any).episodicMemory;
    if (!mem) return {success: false, output: 'EpisodicMemory not available'};
    try {
      await mem.pruneOldEpisodes();
      return {success: true, output: 'Old episodes pruned'};
    } catch (error) {
      return {success: false, output: `Error: ${error instanceof Error ? error.message : String(error)}`};
    }
  }

  private pin(args: string): CommandResult {
    const wm = (this.nar as any).workingMemory;
    if (!wm) return {success: false, output: 'WorkingMemory not available'};
    const parts = args.split(/\s+/);
    if (parts.length < 1) return {success: false, output: 'Usage: /pin <key> <value>'};
    const key = parts[0]!;
    const value = parts.slice(1).join(' ') || '';
    wm.pin(key, value);
    return {success: true, output: `Pinned ${key} = ${value}`};
  }

  private pinned(): CommandResult {
    const wm = (this.nar as any).workingMemory;
    if (!wm) return {success: false, output: 'WorkingMemory not available'};
    const all: Map<string, string> = wm.recallAll();
    if (all.size === 0) return {success: true, output: 'Working memory is empty'};
    const lines = [...all.entries()].map(([k, v]) => `${k}: ${v}`);
    return {success: true, output: `Pinned items:\n${lines.join('\n')}`};
  }

  private unpin(args: string): CommandResult {
    const wm = (this.nar as any).workingMemory;
    if (!wm) return {success: false, output: 'WorkingMemory not available'};
    if (!args) {
      wm.unpin();
      return {success: true, output: 'Working memory cleared'};
    }
    wm.unpin(args);
    return {success: true, output: `Unpinned ${args}`};
  }

  private identity(): CommandResult {
    const stateManager = (this.bot as any).stateManager;
    if (!stateManager) {
      return {success: false, output: 'State manager not available'};
    }

    const resolver = stateManager.getIdentityResolver?.();
    if (!resolver) {
      return {success: false, output: 'Identity resolver not available'};
    }

    const stats = resolver.getStats();
    const identities = resolver.getAllIdentities();

    const lines = [
      `Identity Resolution Summary:`,
      `  Total identities: ${stats.totalIdentities}`,
      `  Total aliases: ${stats.totalAliases}`,
      `  Avg aliases per identity: ${stats.avgAliasesPerIdentity.toFixed(2)}`,
      ``,
      `Active identities:`,
    ];

    for (const identity of identities.slice(0, 10)) {
      lines.push(`  ${identity.canonicalId}: ${identity.allAliases.join(', ')}`);
    }

    if (identities.length > 10) {
      lines.push(`  ... and ${identities.length - 10} more`);
    }

    return {success: true, output: lines.join('\n')};
  }

  private identityDetail(canonicalId: string): CommandResult {
    const stateManager = (this.bot as any).stateManager;
    if (!stateManager) {
      return {success: false, output: 'State manager not available'};
    }

    const resolver = stateManager.getIdentityResolver?.();
    if (!resolver) {
      return {success: false, output: 'Identity resolver not available'};
    }

    const metadata = resolver.getIdentityMetadata(canonicalId);
    if (!metadata) {
      return {success: false, output: `Identity not found: ${canonicalId}`};
    }

    const aliases = resolver.getIdentities(canonicalId);
    const lines = [
      `Identity: ${canonicalId}`,
      `  Aliases: ${aliases.join(', ')}`,
      `  Hostmask: ${metadata.hostmask || 'N/A'}`,
      `  Auth ID: ${metadata.authId || 'N/A'}`,
      `  Nick: ${metadata.nick || 'N/A'}`,
      `  Username: ${metadata.username || 'N/A'}`,
      `  Last seen: ${new Date(metadata.lastSeen).toLocaleString()}`,
    ];

    return {success: true, output: lines.join('\n')};
  }
}

export function createREPLCommands(bot: Bot, nar: NAR): REPLCommands {
  return new REPLCommands(bot, nar);
}
