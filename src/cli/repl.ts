/**
 * SeNARS CLI REPL
 * Interactive terminal interface for neuro-symbolic reasoning
 */

import { NAR } from '../nar/nar.js';
import * as readline from 'readline';
import { promises as fs, existsSync } from 'fs';
import { SeNARSFactory } from '../nar/factory.js';
import { createRequire } from 'module';

const HISTFILE = process.env.SENARS_HISTFILE || '/tmp/senars_history';
const MAX_HISTORY = 1000;

interface CLIConfig {
  maxConcepts: number;
  maxDerivationDepth: number;
  showDerivations: boolean;
}

interface ProfileSession {
  startTime: number;
  startStats: any;
}

class SeNARSCLI {
  private nar: NAR;
  private config: CLIConfig;
  private rl: readline.Interface;
  private history: string[] = [];
  private historyIndex = -1;
  private profileSession: ProfileSession | null = null;
  private multiLineBuffer: string[] = [];
  private inMultiLine = false;

  constructor(config: Partial<CLIConfig> = {}) {
    this.config = {
      maxConcepts: config.maxConcepts ?? 100,
      maxDerivationDepth: config.maxDerivationDepth ?? 10,
      showDerivations: config.showDerivations ?? true
    };

    this.nar = SeNARSFactory.createForCLI({
      maxConcepts: this.config.maxConcepts,
      maxDerivationDepth: this.config.maxDerivationDepth
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'senars> ',
      completer: this.completer.bind(this) as any
    });

    this.loadHistory();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.rl.on('line', async (line) => {
      if (this.inMultiLine) {
        if (line.trim() === '.') {
          this.inMultiLine = false;
          const input = this.multiLineBuffer.join('\n');
          this.multiLineBuffer = [];
          this.addToHistory(input);
          await this.processInput(input);
        } else {
          this.multiLineBuffer.push(line);
        }
        this.rl.prompt();
        return;
      }

      const trimmed = line.trim();
      if (trimmed) {
        if (trimmed.startsWith('{')) {
          this.inMultiLine = true;
          this.multiLineBuffer = [trimmed];
          this.rl.prompt();
          return;
        }
        this.addToHistory(trimmed);
        await this.processInput(trimmed);
      }
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.saveHistory();
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  private completer(line: string): [string[], string] {
    const commands = ['.help', '.run', '.stats', '.list', '.concepts', '.rules', '.tools', 
      '.query', '.trace', '.explain', '.clear', '.reset', '.load', '.save', 
      '.config', '.profile', '.quit'];
    
    const parts = line.split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    
    if (line.startsWith('.')) {
      const matches = commands.filter(cmd => cmd.startsWith(lastPart));
      return [matches.length ? matches : [line], lastPart];
    }
    
    const concepts = this.nar.listConcepts().slice(0, 50);
    const conceptTerms = concepts.map(c => c.term.toString());
    const matches = conceptTerms.filter(term => term.startsWith(lastPart));
    
    return [matches.length ? matches : [line], lastPart];
  }

  private addToHistory(input: string): void {
    if (this.history[this.history.length - 1] !== input) {
      this.history.push(input);
      if (this.history.length > MAX_HISTORY) {
        this.history.shift();
      }
    }
    this.historyIndex = this.history.length;
  }

  private async loadHistory(): Promise<void> {
    try {
      if (existsSync(HISTFILE)) {
        const content = await fs.readFile(HISTFILE, 'utf-8');
        this.history = content.split('\n').filter(line => line.trim()).slice(-MAX_HISTORY);
        this.historyIndex = this.history.length;
      }
    } catch (e) {
      this.history = [];
      this.historyIndex = 0;
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(HISTFILE, this.history.join('\n'), 'utf-8');
    } catch (e) {
      // Ignore history save errors
    }
  }

  private async processInput(input: string): Promise<void> {
    if (input.startsWith('.')) {
      await this.handleCommand(input);
    } else if (input.endsWith('?')) {
      await this.handleQuestion(input.slice(0, -1).trim());
    } else if (input.endsWith('.')) {
      await this.handleBelief(input.slice(0, -1).trim());
    } else {
      console.log('Use (term). for beliefs, (term)? for questions, or .help');
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/);
    const cmd = parts[0]!;
    const args = parts.slice(1);

    const handlers: Record<string, () => void | Promise<void>> = {
      '.help': () => this.showHelp(args[0]),
      '.run': () => this.runInference(args[0] ? parseInt(args[0]) : 5),
      '.stats': () => this.showStats(args[0]),
      '.list': () => this.listConcepts(),
      '.concepts': () => this.showConcepts(args.join(' ')),
      '.rules': () => this.showRules(args.join(' ')),
      '.tools': () => this.showTools(args.join(' ')),
      '.config': () => this.handleConfig(args),
      '.clear': () => this.clearMemory(),
      '.reset': () => this.resetMemory(),
      '.load': () => this.loadFile(args[0]),
      '.save': () => this.saveMemory(args[0]),
      '.query': () => this.queryTerm(args.join(' ')),
      '.trace': () => this.traceTerm(args.join(' ')),
      '.explain': () => this.explainTerm(args.join(' ')),
      '.profile': () => this.handleProfile(args),
      '.quit': () => {
        console.log('Goodbye!');
        process.exit(0);
      }
    };

    const handler = handlers[cmd];
    if (handler) {
      try {
        await handler();
      } catch (error) {
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log(`Unknown command: ${cmd}. Type .help for commands.`);
    }
  }

  private async handleBelief(term: string): Promise<void> {
    try {
      await this.nar.input(term);
      console.log(`✓ Added: ${term}`);
    } catch (error) {
      console.log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleQuestion(term: string): Promise<void> {
    try {
      await this.nar.question(term);
      const derived = await this.nar.run(5);

      if (derived > 0) {
        console.log(`✓ Derived ${derived} new belief(s)`);
      } else {
        console.log('? No derivation found');
      }
    } catch (error) {
      console.log(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runInference(steps: number): Promise<void> {
    const derived = await this.nar.run(steps);
    console.log(`✓ Ran ${steps} step(s), derived ${derived} belief(s)`);
  }

  private showStats(detail?: string): void {
    const stats = this.nar.getStatistics();
    const metrics = this.nar.getMetrics();
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║ SeNARS Statistics                                      ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Concepts: ${String(stats.totalConcepts).padEnd(48)}║`);
    console.log(`║ Tasks: ${String(stats.totalTasks).padEnd(49)}║`);
    
    if (detail === 'detail' || detail === 'all') {
      const ruleExecs = (metrics as any).ruleExecutions?.total || 0;
      const derivs = (metrics as any).derivations || 0;
      const steps = (metrics as any).steps || 0;
      console.log(`║ Rule Executions: ${String(ruleExecs).padEnd(41)}║`);
      console.log(`║ Derivations: ${String(derivs).padEnd(45)}║`);
      console.log(`║ Steps: ${String(steps).padEnd(51)}║`);
    }
    
    console.log('╚════════════════════════════════════════════════════════╝\n');
  }

  private listConcepts(): void {
    const concepts = this.nar.listConcepts();
    if (concepts.length === 0) {
      console.log('Memory is empty');
      return;
    }

    console.log('\nConcepts:');
    for (const concept of concepts.slice(0, 20)) {
      console.log(` - ${concept.term.toString()}`);
    }
    if (concepts.length > 20) {
      console.log(` ... and ${concepts.length - 20} more`);
    }
    console.log();
  }

  private showConcepts(filter?: string): void {
    const concepts = this.nar.listConcepts();
    let filtered = concepts;

    if (filter) {
      filtered = concepts.filter(c => 
        c.term.toString().toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (filtered.length === 0) {
      console.log(filter ? `No concepts matching '${filter}'` : 'Memory is empty');
      return;
    }

    console.log(`\nConcepts (${filtered.length} total):`);
    for (const concept of filtered.slice(0, 50)) {
      console.log(`  ${concept.term.toString()}`);
    }
    if (filtered.length > 50) {
      console.log(`  ... and ${filtered.length - 50} more`);
    }
    console.log();
  }

  private showRules(filter?: string): void {
    console.log('\nRegistered Rules:');
    console.log('  (Rules are defined in RuleProcessor)');
    console.log('  - deduction: (A --> B), (B --> C) => (A --> C)');
    console.log('  - induction: (A --> B), (A --> C) => (C --> B)');
    console.log('  - abduction: (A --> C), (B --> C) => (A --> B)');
    console.log('  - revision: Merge conflicting beliefs');
    console.log('  - LM rules: Dynamic language model inference');
    console.log();
  }

  private showTools(filter?: string): void {
    console.log('\nAvailable Tools:');
    const tools = ['calculate', 'sleep', 'readFile', 'writeFile', 'http'];
    
    const filtered = filter 
      ? tools.filter(t => t.toLowerCase().includes(filter.toLowerCase()))
      : tools;

    for (const tool of filtered) {
      console.log(`  - ${tool}`);
    }
    console.log();
  }

  private handleConfig(args: string[]): void {
    if (args.length === 0) {
      const config = this.nar.getConfig();
      console.log('\nCurrent Configuration:');
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${key}: ${String(value)}`);
      }
      console.log();
      return;
    }

    if (args.length === 1) {
      const config = this.nar.getConfig();
      const value = config[args[0] as keyof typeof config];
      console.log(`${args[0]}: ${String(value ?? 'unknown')}`);
      return;
    }

    if (args.length === 2) {
      const [key, value] = args;
      const config = this.nar.getConfig();
      const typedValue = isNaN(Number(value)) ? value : Number(value);
      this.nar.setConfig({ [key!]: typedValue } as any);
      console.log(`Set ${key} to ${typedValue}`);
    }
  }

  private resetMemory(): void {
    this.nar.clearMemory();
    console.log('✓ Memory cleared and system reset');
  }

  private clearMemory(): void {
    this.nar.clearMemory();
    console.log('✓ Memory cleared');
  }

  private async loadFile(filename: string | undefined): Promise<void> {
    if (!filename) {
      console.log('Usage: .load <filename>');
      return;
    }

    const content = await fs.readFile(filename, 'utf-8');
    const lines = content.split('\n');
    let loaded = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(';')) {
        await this.nar.input(trimmed);
        loaded++;
      }
    }

    console.log(`✓ Loaded ${loaded} belief(s) from ${filename}`);
  }

  private async saveMemory(filename: string | undefined): Promise<void> {
    if (!filename) {
      console.log('Usage: .save <filename>');
      return;
    }

    const concepts = this.nar.listConcepts().map(c => ({
      term: c.term.toString(),
      beliefs: c.beliefBag?.toArray() || [],
      goals: c.goalBag?.toArray() || []
    }));

    const data = {
      concepts,
      timestamp: new Date().toISOString(),
      statistics: this.nar.getStatistics()
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`✓ Saved ${concepts.length} concept(s) to ${filename}`);
  }

  private async queryTerm(termStr: string): Promise<void> {
    if (!termStr) {
      console.log('Usage: .query <term>');
      return;
    }

    try {
      const filter = { contains: termStr };
      const beliefs = this.nar.getBeliefs(filter);
      const goals = this.nar.getGoals(filter);
      const questions = this.nar.getQuestions(filter);

      console.log('\nQuery Results:');
      console.log(`Beliefs: ${beliefs.length}`);
      console.log(`Goals: ${goals.length}`);
      console.log(`Questions: ${questions.length}`);

      const all = [...beliefs, ...goals, ...questions];
      if (all.length > 0) {
        console.log('\nMatches:');
        all.slice(0, 10).forEach(item => {
          const truthStr = item.truth ? ` f=${item.truth.f.toFixed(2)} c=${item.truth.c.toFixed(2)}` : '';
          console.log(`  ${item.term.toString()} [${item.type}]${truthStr}`);
        });
        if (all.length > 10) {
          console.log(`  ... and ${all.length - 10} more`);
        }
      }
    } catch (error) {
      console.log(`Query error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async traceTerm(termStr: string): Promise<void> {
    if (!termStr) {
      console.log('Usage: .trace <term>');
      return;
    }

    try {
      const beliefs = this.nar.getBeliefs({ contains: termStr });
      
      if (beliefs.length === 0) {
        console.log(`No beliefs found for: ${termStr}`);
        return;
      }

      const trace = this.nar.traceTerm(termStr as any);
      const traceData = trace as any;

      if (!traceData || (traceData as any).length === 0) {
        console.log(`No derivation trace found for: ${termStr}`);
        return;
      }

      const traceArray = Array.isArray(traceData) ? traceData : [traceData];
      
      console.log('\nDerivation Trace:');
      traceArray.slice(-10).forEach((step: any, index: number) => {
        const source = step.stamp?.source || step.stamp?.derivations ? 'DERIVED' : 'INPUT';
        console.log(`${index + 1}. ${step.term?.toString() || 'unknown'} [${source}]`);
      });

      if (traceArray.length > 10) {
        console.log(`  ... and ${traceArray.length - 10} more steps`);
      }
    } catch (error) {
      console.log(`Trace error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async explainTerm(termStr: string): Promise<void> {
    if (!termStr) {
      console.log('Usage: .explain <term>');
      return;
    }

    try {
      const beliefs = this.nar.getBeliefs({ contains: termStr });

      if (beliefs.length === 0) {
        console.log(`No beliefs found for: ${termStr}`);
        return;
      }

      const topBelief = beliefs[0]!;
      const explanation = this.nar.explain(topBelief as any);

      console.log('\nExplanation:');
      console.log(`Term: ${topBelief.term.toString()}`);
      console.log(`Type: ${topBelief.type}`);
      console.log(`Truth: f=${topBelief.truth.f.toFixed(2)}, c=${topBelief.truth.c.toFixed(2)}`);
      console.log(`Source: ${topBelief.stamp?.source || 'DERIVED'}`);

      if (explanation) {
        console.log('\nDerivation path:');
        if (Array.isArray(explanation)) {
          explanation.slice(-5).forEach((step: any, i: number) => {
            console.log(`  ${i + 1}. ${typeof step === 'string' ? step : step.toString()}`);
          });
        } else {
          console.log(`  ${explanation}`);
        }
      } else {
        console.log('  (No derivation path available)');
      }
    } catch (error) {
      console.log(`Explain error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private showHelp(command?: string): void {
    if (command) {
      const helpText: Record<string, string> = {
        '.help': 'Show help for a command',
        '.run': 'Run inference steps: .run [steps]',
        '.stats': 'Show statistics: .stats [detail]',
        '.concepts': 'List concepts: .concepts [filter]',
        '.rules': 'List registered rules: .rules',
        '.tools': 'List available tools: .tools',
        '.query': 'Query memory: .query <term>',
        '.trace': 'Show derivation: .trace <term>',
        '.explain': 'Explain belief: .explain <term>',
        '.config': 'View/set config: .config [key] [value]',
        '.save': 'Save memory: .save <file>',
        '.load': 'Load file: .load <file>',
        '.reset': 'Clear memory and restart',
        '.profile': 'Start/stop profiling: .profile [start|stop]',
        '.clear': 'Clear memory',
        '.quit': 'Exit'
      };

      const text = helpText[command] || 'Unknown command';
      console.log(`\n${command}: ${text}\n`);
      return;
    }

    console.log(`
╔══════════════════════════════════════════════════╗
║ SeNARS CLI Commands                              ║
╠══════════════════════════════════════════════════╣
║ (term).         Add belief                       ║
║ (term)?         Ask question                     ║
║ { ... }.        Multi-line input                 ║
║ .run [n]        Run n inference steps            ║
║ .stats [detail] Show statistics                  ║
║ .concepts [f]   List concepts (filter)           ║
║ .rules          List registered rules            ║
║ .tools [f]      List available tools             ║
║ .query <term>   Query memory                     ║
║ .trace <term>   Show derivation history          ║
║ .explain <term> Explain why derived              ║
║ .config [k] [v] View/set config                  ║
║ .clear          Clear memory                     ║
║ .reset          Clear and restart                ║
║ .load <file>    Load Narsese file                ║
║ .save <file>    Save memory to JSON              ║
║ .profile [cmd]  Performance profiling            ║
║ .help [cmd]     Show help                        ║
║ .quit           Exit                             ║
╚══════════════════════════════════════════════════╝
`);
  }

  private handleProfile(args: string[]): void {
    const cmd = args[0];

    if (cmd === 'start' || !cmd) {
      if (this.profileSession) {
        console.log('Profile session already running');
        return;
      }
      this.profileSession = {
        startTime: Date.now(),
        startStats: this.nar.getStatistics()
      };
      console.log('✓ Profile started');
    } else if (cmd === 'stop') {
      if (!this.profileSession) {
        console.log('No profile session running');
        return;
      }
      const duration = Date.now() - this.profileSession.startTime;
      const endStats = this.nar.getStatistics();
      console.log('\nProfile Results:');
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Concepts: ${endStats.totalConcepts - (this.profileSession.startStats.totalConcepts || 0)}`);
      console.log(`  Tasks: ${endStats.totalTasks - (this.profileSession.startStats.totalTasks || 0)}`);
      this.profileSession = null;
      console.log();
    }
  }

  start(): void {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS CLI REPL v1.0                               ║');
    console.log('║ Neuro-Symbolic Reasoning System                    ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('\nType .help for commands, .quit to exit\n');
    this.rl.prompt();
  }
}

export type { SeNARSCLI };

const cli = new SeNARSCLI();
cli.start();
