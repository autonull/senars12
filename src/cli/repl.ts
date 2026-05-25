/**
 * SeNARS CLI REPL — Pipe-mode interactive shell
 */

import {SeNARSFactory} from '../nar/factory.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {OutputFormatter} from './OutputFormatter.js';

import {createInterface} from 'node:readline';

const fmt = new OutputFormatter('cli', {
  json: process.argv.includes('--json'),
  quiet: process.argv.includes('--quiet'),
  noInit: process.argv.includes('--no-init'),
});

let running = true;

export class SeNARSCLI {
  private nar: Awaited<ReturnType<typeof SeNARSFactory.createDefault>>;
  private turn = 0;

  private constructor(nar: any) {
    this.nar = nar;
  }

static async create(): Promise<SeNARSCLI> {
 const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
  providerRegistry: registry,
  core: {maxConcepts: 200},
  enableLMRules: true,
}) as any;

 await nar.initialize();
 const lmClient = nar.getLMClient?.();
 if (lmClient?.init) {
   process.stderr.write('Loading language model (first run may download weights)...\n');
   await lmClient.init().catch((err: any) => {
     process.stderr.write(`LM init warning: ${err.message}\n`);
   });
   if (lmClient.available) {
     process.stderr.write('Language model ready.\n');
   } else {
     process.stderr.write('Running without language model.\n');
   }
 }
 return new SeNARSCLI(nar);
 }

  async processLine(line: string): Promise<string> {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '' || trimmed.startsWith('#')) return '';

    this.turn++;

    if (trimmed.startsWith('.')) {
      return this.handleCommand(trimmed);
    }

    return this.handleNarsese(trimmed);
  }

  async handleNarsese(input: string): Promise<string> {
    const lines: string[] = [];
    const isGoal = input.endsWith('!');
    const isQuestion = input.endsWith('?');
    const nar = this.nar as any;

    if (isGoal) {
      await nar.input(input, 'goal');
      lines.push(fmt.formatResponse(`GOAL: ${input}`));
    } else if (isQuestion) {
      const cleanQ = input.replace(/[?!.]+$/, '');
      const beliefs = nar.getBeliefs?.() ?? [];
      const match = beliefs.find((b: any) => b.term.toString().includes(cleanQ.split('-->')[0] ?? cleanQ));
      lines.push(fmt.formatResponse(match ? `Answer: ${match.term.toString()} f=${match.truth.f.toFixed(2)} c=${match.truth.c.toFixed(2)}` : `No answer for: ${input}`));
    } else {
      const clean = input.replace(/[?!.]+$/, '');
      await nar.input(clean, 'belief');
      const derived = await nar.run(3);
      const ruleLog = nar.getLMRuleExecutionLog?.() ?? [];
      const fired = ruleLog.filter((e: any) => e.status === 'fired');
      const skipped = ruleLog.filter((e: any) => e.status === 'skipped');
      lines.push(fmt.formatResponse(`+ ${clean} │ derived ${derived}`));
      lines.push(fmt.formatResponse(fired.length > 0 ? ` lm: ${fired.length} rules fired, ${skipped.length} skipped` : ` lm: all ${skipped.length} rules skipped`));

      // Show high-priority concepts
      const highPri = nar.listConcepts?.()?.filter((c: any) => c.priority >= 0.5).sort((a: any, b: any) => b.priority - a.priority).slice(0, 3) ?? [];
      if (highPri.length > 0) {
        lines.push(fmt.formatResponse(` priorities: ${highPri.map((c: any) => `${c.term.toString().slice(0, 25)}:${c.priority.toFixed(2)}`).join(', ')}`));
      }
    }

    return lines.join('\n');
  }

  async handleCommand(cmd: string): Promise<string> {
    const parts = cmd.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    const nar = this.nar as any;

    switch (command) {
      case '.help': {
        return fmt.formatResponse([
          'Commands:',
          ' (a --> b). Add a belief',
          ' (a --> b)? Ask a question',
          ' (a --> b)! Set a goal',
          ' .run [n] Run n inference cycles',
          ' .stats Show statistics',
          ' .beliefs Show beliefs',
          ' .goals Show goal status',
          ' .concepts Show concepts',
          ' .priorities Show concept priorities',
          ' .lm Show LM info (client + model)',
          ' .rules Show LM rule execution log',
          ' .trace Show temporal trace (flame chart)',
          ' .lm-debug Show detailed LM client stats',
          ' .clear Clear memory',
          ' .quit Exit',
        ].join('\n< '));
      }
      case '.run': {
        const n = parseInt(args[0] ?? '5', 10);
        nar.clearLMRuleExecutionLog?.();
        const derived = await nar.run(n);
        return fmt.formatResponse(`Ran ${n} cycle(s), derived ${derived}`);
      }
      case '.stats': {
        const stats = nar.getStatistics();
        const beliefs = nar.getBeliefs?.() ?? [];
        const goals = nar.getGoals?.() ?? [];
        const concepts = nar.listConcepts?.() ?? [];
        return fmt.formatResponse(`concepts:${concepts.length} beliefs:${beliefs.length} goals:${goals.length} tasks:${stats.totalTasks}`);
      }
      case '.beliefs': {
        const beliefs = nar.getBeliefs?.() ?? [];
        if (beliefs.length === 0) return fmt.formatResponse('No beliefs');
        const lines = beliefs.slice(0, 20).map((b: any) =>
          ` ${b.term.toString().padEnd(30)} f=${b.truth?.f.toFixed(2) ?? '0.00'} c=${b.truth?.c.toFixed(2) ?? '0.00'}`
        );
        return fmt.formatResponse(`Beliefs (${beliefs.length}):\n< ${lines.join('\n< ')}`);
      }
      case '.goals': {
        const goals = nar.getGoals?.() ?? [];
        if (goals.length === 0) return fmt.formatResponse('No active goals');
        const lines = goals.map((g: any) => {
          const chk = nar.checkGoalSatisfaction?.(g.term.toString()) ?? {satisfied: false, truthFreq: 0, truthConf: 0};
          return ` ${g.term.toString()} sat=${chk.satisfied} f=${chk.truthFreq.toFixed(2)} c=${chk.truthConf.toFixed(2)}`;
        });
        return fmt.formatResponse(`Goals (${goals.length}):\n< ${lines.join('\n< ')}`);
      }
      case '.concepts': {
        const concepts = nar.listConcepts?.() ?? [];
        return fmt.formatResponse(`Concepts (${concepts.length}): ${concepts.slice(0, 10).map((c: any) => c.term.toString()).join(', ')}`);
      }
      case '.priorities': {
        const concepts = nar.listConcepts?.() ?? [];
        const sorted = concepts.sort((a: any, b: any) => b.priority - a.priority).slice(0, 15);
        const bar = (p: number) => p >= 0.5 ? '**' : '--';
        return fmt.formatResponse(sorted.map((c: any) =>
          ` ${c.term.toString().padEnd(25)} p=${c.priority.toFixed(2)} ${bar(c.priority)}`).join('\n< '));
      }
      case '.lm': {
        const lm = nar.getLMClient?.();
        const available = lm?.available ?? false;
        const stats = lm?.getStats?.();
        const lines = [
          `LM: ${available ? 'available' : 'unavailable'}`,
          `Provider: ${lm?.provider ?? 'none'}`,
          `Model: ${lm?.model ?? 'none'}`,
        ];
        if (stats) {
          lines.push(`Calls: ${stats.totalCalls} (ok:${stats.successfulCalls} fail:${stats.failedCalls} timeout:${stats.timeoutCount})`);
          lines.push(`Avg duration: ${Math.round(stats.averageDuration)}ms`);
          lines.push(`Queue depth: ${stats.queueDepth} (high water: ${stats.queueHighWater})`);
        }
        return fmt.formatResponse(lines.join('\n< '));
      }
      case '.rules': {
        const ruleLog = nar.getLMRuleExecutionLog?.() ?? [];
        if (ruleLog.length === 0) return fmt.formatResponse('No LM rules have been executed yet. Run some inference first.');
        const rows = ['LM Rule Execution Log:'];
        for (const entry of ruleLog) {
          const statusBadge = entry.status === 'fired' ? '+' : entry.status === 'skipped' ? '·' : entry.status === 'timeout' ? '!' : entry.status === 'aborted' ? '✗' : '?';
          rows.push(` ${statusBadge} ${entry.ruleName.padEnd(35)} ${entry.status.padEnd(8)} ${String(entry.durationMs).padStart(5)}ms tasks:${entry.tasksProduced}`);
        }
        return fmt.formatResponse(rows.join('\n< '));
      }
      case '.trace': {
        const phaseTimer = nar.getPhaseTimer?.();
        if (!phaseTimer) return fmt.formatResponse('No trace data. Run some inference first.');
        return fmt.formatResponse(phaseTimer.formatFlameChart());
      }
      case '.lm-debug': {
        const lm = nar.getLMClient?.();
        const stats = lm?.getStats?.();
        if (!stats) return fmt.formatResponse('LM client does not expose stats');
        return fmt.formatResponse([
          `LM Client Debug (${lm?.provider}/${lm?.model}):`,
          ` Available: ${lm?.available}`,
          ` Total calls: ${stats.totalCalls}`,
          ` Successful: ${stats.successfulCalls}`,
          ` Failed: ${stats.failedCalls}`,
          ` Timeouts: ${stats.timeoutCount}`,
          ` Total duration: ${stats.totalDuration}ms`,
          ` Avg duration: ${Math.round(stats.averageDuration)}ms`,
          ` Queue depth: ${stats.queueDepth}`,
          ` Queue high water: ${stats.queueHighWater}`,
        ].join('\n< '));
      }
      case '.clear': {
        nar.clearMemory();
        return fmt.formatResponse('Memory cleared');
      }
      case '.quit':
      case '.exit': {
        running = false;
        return fmt.formatResponse('Goodbye.');
      }
      default:
        return fmt.formatResponse(`Unknown command: ${command} (try .help)`);
    }
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }
}

async function main() {
  const cli = await SeNARSCLI.create();
  const isPipe = !process.stdin.isTTY;

  if (isPipe) {
    const rl = createInterface({input: process.stdin, output: process.stdout});
    for await (const line of rl) {
      if (!running) break;
      const result = await cli.processLine(line);
      if (result) console.log(result);
      await new Promise(resolve => setImmediate(resolve));
    }
    await cli.stop();
    process.stdout.end();
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'senars> ',
    });

    console.log('\n SeNARS Cognitive REPL');
    console.log(' Type .help for commands, .quit to exit\n');
    console.log(' LM: Transformers.js ready\n');

    rl.prompt();
    for await (const line of rl) {
      if (!running) break;
      const result = await cli.processLine(line);
      if (result) console.log(result);
      if (running) {
        rl.prompt();
      }
    }
    await cli.stop();
    rl.close();
  }
}

main().catch(err => {
  console.error(fmt.formatError(err.message));
  process.exit(1);
});
