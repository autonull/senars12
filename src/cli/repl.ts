/**
 * SeNARS CLI REPL
 * Interactive terminal interface for neuro-symbolic reasoning
 */

import { NAR } from '../nar/nar.js';
import * as readline from 'readline';
import { promises as fs } from 'fs';
import { SeNARSFactory } from '../nar/factory.js';

interface CLIConfig {
  maxConcepts: number;
  maxDerivationDepth: number;
  showDerivations: boolean;
}

class SeNARSCLI {
  private nar: NAR;
  private config: CLIConfig;
  private rl: readline.Interface;
  private history: string[] = [];

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
      prompt: 'senars> '
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        this.history.push(trimmed);
        await this.processInput(trimmed);
      }
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
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
      '.help': () => this.showHelp(),
      '.run': () => this.runInference(args[0] ? parseInt(args[0]) : 5),
      '.stats': () => this.showStats(),
      '.list': () => this.listConcepts(),
      '.clear': () => this.clearMemory(),
      '.load': () => this.loadFile(args[0]),
      '.save': () => this.saveMemory(args[0]),
      '.query': () => this.queryTerm(args.join(' ')),
      '.trace': () => this.traceTerm(args.join(' ')),
      '.explain': () => this.explainTerm(args.join(' ')),
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

  private showStats(): void {
    const stats = this.nar.getStatistics();
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║ SeNARS Statistics ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Concepts: ${String(stats.totalConcepts).padEnd(48)}║`);
    console.log(`║ Tasks: ${String(stats.totalTasks).padEnd(49)}║`);
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

    const data = {
      concepts: this.nar.listConcepts().map(c => c.term.toString()),
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`✓ Saved to ${filename}`);
  }

  private async queryTerm(termStr: string): Promise<void> {
    console.log('Query functionality pending full integration');
    console.log(`Would query for: ${termStr}`);
  }

  private async traceTerm(termStr: string): Promise<void> {
    console.log('Trace functionality pending full integration');
    console.log(`Would trace: ${termStr}`);
  }

  private async explainTerm(termStr: string): Promise<void> {
    console.log('Explain functionality pending full integration');
    console.log(`Would explain: ${termStr}`);
  }

  private showHelp(): void {
    console.log(`
╔══════════════════════════════════════════════════╗
║ SeNARS CLI Commands ║
╠══════════════════════════════════════════════════╣
║ (term). Add belief ║
║ (term)? Ask question ║
║ .run [n] Run n inference steps ║
║ .stats Show detailed statistics ║
║ .list List all concepts ║
║ .query <term> Query memory for term ║
║ .trace <term> Show derivation history ║
║ .explain <term> Explain why derived ║
║ .clear Clear memory ║
║ .load <file> Load Narsese file ║
║ .save <file> Save memory to JSON ║
║ .help Show this help ║
║ .quit Exit ║
╚══════════════════════════════════════════════════╝
`);
  }

  start(): void {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS CLI REPL v1.0 ║');
    console.log('║ Neuro-Symbolic Reasoning System ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('\nType .help for commands, .quit to exit\n');
    this.rl.prompt();
  }
}

export type { SeNARSCLI };

const cli = new SeNARSCLI();
cli.start();
