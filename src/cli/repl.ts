/**
 * SeNARS CLI REPL
 * Interactive terminal interface for neuro-symbolic reasoning
 */

import {NAR, SeNARSFactory} from '../nar';
import * as readline from 'readline';
import {existsSync, promises as fs} from 'fs';

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
    private readonly nar: NAR;
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

    start(): void {
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ SeNARS CLI REPL v1.0                               ║');
        console.log('║ Neuro-Symbolic Reasoning System                    ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\nType .help for commands, .quit to exit\n');
        this.rl.prompt();
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
      '.query', '.trace', '.explain', '.clear', '.load', '.save',
      '.config', '.profile', '.quit', '.self', '.meta', '.optimize',
      '.prefer', '.reward', '.rlfp-stats', '.lm-status', '.lm-switch', '.ask-nl',
      '.constitution', '.attention', '.load-domain'];

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
        } catch {
            this.history = [];
            this.historyIndex = 0;
        }
    }

    private async saveHistory(): Promise<void> {
        try {
            await fs.writeFile(HISTFILE, this.history.join('\n'), 'utf-8');
        } catch {
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
    '.load': () => this.loadFile(args[0]),
            '.save': () => this.saveMemory(args[0]),
            '.query': () => this.queryTerm(args.join(' ')),
            '.trace': () => this.traceTerm(args.join(' ')),
            '.explain': () => this.explainTerm(args.join(' ')),
            '.profile': () => this.handleProfile(args),
            '.self': () => this.showSelfStatus(),
            '.meta': () => this.showMetaAnalysis(),
            '.optimize': () => this.runOptimization(),
            '.prefer': () => this.handlePrefer(args),
            '.reward': () => this.showRewardStatus(),
            '.rlfp-stats': () => this.showRLFPStats(),
            '.lm-status': () => this.showLMStatus(),
            '.lm-switch': () => this.switchLMModel(args[0]),
            '.ask-nl': () => this.askNaturalLanguage(args.join(' ')),
            '.constitution': () => this.showConstitution(args),
            '.attention': () => this.showAttention(),
            '.load-domain': () => this.loadDomain(args),
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

    private showRules(_filter?: string): void {
        console.log('\nRegistered Rules:');
        console.log(' (Rules are defined in RuleProcessor)');
        console.log(' - deduction: (A --> B), (B --> C) => (A --> C)');
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
            const typedValue = isNaN(Number(value)) ? value : Number(value);
            this.nar.setConfig({[key!]: typedValue} as any);
            console.log(`Set ${key} to ${typedValue}`);
        }
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
            const beliefs = this.nar.getBeliefs();
            const goals = this.nar.getGoals();
            const questions = this.nar.getQuestions();

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
            const beliefs = this.nar.getBeliefs({contains: termStr});

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
            const beliefs = this.nar.getBeliefs({contains: termStr});

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
                '.tools': 'List available tools: .tools [filter]',
                '.query': 'Query memory: .query <term>',
                '.trace': 'Show derivation: .trace <term>',
                '.explain': 'Explain belief: .explain <term>',
                '.config': 'View/set config: .config [key] [value]',
    '.save': 'Save memory: .save <file>',
    '.load': 'Load file: .load <file>',
    '.profile': 'Start/stop profiling: .profile [start|stop]',
                '.clear': 'Clear memory',
                '.self': 'Show self/metacognition status',
                '.meta': 'Show meta-analysis report',
                '.optimize': 'Apply metacognitive and RLFP optimizations',
                '.prefer': 'Record preference: .prefer <preferred> <rejected>',
                '.reward': 'Show RLFP reward status',
                '.rlfp-stats': 'Show RLFP statistics',
                '.lm-status': 'Show LM connection status',
                '.lm-switch': 'Switch LM model: .lm-switch <model>',
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
║ .config [k] [v] View/set config ║
║ .clear Clear memory ║
║ .load <file> Load Narsese file ║
║ .save <file>    Save memory to JSON             ║
║ .profile [cmd]  Performance profiling            ║
╠══════════════════════════════════════════════════╣
║ Self/Metacognition:                              ║
║ .self           Show self status                 ║
║ .meta           Show meta-analysis               ║
║ .optimize       Apply optimizations now          ║
╠══════════════════════════════════════════════════╣
║ RLFP:                                            ║
║ .prefer A B      Record A > B preference        ║
║ .reward          Show reward status              ║
║ .rlfp-stats      Show RLFP statistics           ║
╠══════════════════════════════════════════════════╣
║ LM:                                              ║
║ .lm-status       Show LM status                 ║
║ .lm-switch <m>   Switch LM model                ║
╠══════════════════════════════════════════════════╣
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

    private showSelfStatus(): void {
        const self = (this.nar as any).self;
        if (!self) {
            console.log('Self/Metacognition is not enabled');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Self/Metacognition Status                        ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Running: ${self.isRunning ? 'Yes' : 'No'.padEnd(44)}║`);
        const analysis = self.getSystemAnalysis?.();
        if (analysis) {
            console.log(`║ Cycles: ${String(analysis.cycleCount ?? 'N/A').padEnd(45)}║`);
            console.log(`║ Strategies: ${String(analysis.strategies?.length ?? 0).padEnd(42)}║`);
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private showMetaAnalysis(): void {
        const self = (this.nar as any).self;
        if (!self) {
            console.log('Self/Metacognition is not enabled');
            return;
        }
        const analysis = self.getSystemAnalysis?.();
        if (!analysis) {
            console.log('No analysis available yet');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Meta-Analysis Report                             ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Cycle Count: ${String(analysis.cycleCount ?? 0).padEnd(40)}║`);
        if (analysis.reasoningQuality) {
            console.log(`║ Reasoning Quality: ${analysis.reasoningQuality.toFixed(2).padEnd(38)}║`);
        }
        if (analysis.strategies?.length) {
            console.log('║ Strategy Performance:');
            for (const s of analysis.strategies.slice(0, 3)) {
                console.log(`║   - ${s.name || 'unknown'}: ${s.efficiency?.toFixed(2) ?? 'N/A'}`);
            }
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private async runOptimization(): Promise<void> {
        const self = (this.nar as any).self;
        if (self?.applyOptimizations) {
            self.applyOptimizations();
            console.log('✓ Applied metacognitive optimizations');
        } else {
            console.log('Self optimization not available');
        }
        const rlfp = (this.nar as any).rlfp;
        if (rlfp?.optimize) {
            rlfp.optimize();
            console.log('✓ RLFP policy optimized');
        }
    }

    private handlePrefer(args: string[]): void {
        if (args.length < 2) {
            console.log('Usage: .prefer <prefered> <rejected>');
            return;
        }
        const rlfp = (this.nar as any).rlfp;
        if (!rlfp?.addPreference) {
            console.log('RLFP not enabled');
            return;
        }
        rlfp.addPreference(args[0], args[1]);
        console.log(`✓ Preference recorded: ${args[0]} > ${args[1]}`);
    }

    private showRewardStatus(): void {
        const rlfp = (this.nar as any).rlfp;
        if (!rlfp) {
            console.log('RLFP not enabled');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ RLFP Reward Status                               ║');
        console.log('╠══════════════════════════════════════════════════╣');
        const prefs = rlfp.preferences?.length ?? 0;
        console.log(`║ Preferences: ${String(prefs).padEnd(43)}║`);
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private showRLFPStats(): void {
        const rlfp = (this.nar as any).rlfp;
        if (!rlfp) {
            console.log('RLFP not enabled');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ RLFP Statistics                                  ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Preferences: ${String(rlfp.preferences?.length ?? 0).padEnd(43)}║`);
        console.log(`║ Trajectories: ${String(rlfp.trajectoryCount ?? 0).padEnd(41)}║`);
        console.log(`║ Last Optimization: ${rlfp.lastOptimizeTime ? new Date(rlfp.lastOptimizeTime).toLocaleTimeString() : 'Never'.padEnd(26)}║`);
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private showLMStatus(): void {
        const lm = (this.nar as any).lmClient;
        if (!lm) {
            console.log('LM client not configured');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ LM Status                                        ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Provider: ${String(lm.provider ?? 'unknown').padEnd(43)}║`);
        console.log(`║ Model: ${String(lm.model ?? 'unknown').padEnd(45)}║`);
        console.log(`║ Available: ${String(lm.available ? 'Yes' : 'No').padEnd(41)}║`);
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private switchLMModel(model: string | undefined): void {
        if (!model) {
            console.log('Usage: .lm-switch <model-name>');
            return;
        }
        const lm = (this.nar as any).lmClient;
        if (!lm) {
            console.log('LM client not configured');
            return;
        }
        if (lm.setModel) {
            lm.setModel(model);
            console.log(`✓ Switched to model: ${model}`);
        } else {
            console.log('Model switching not supported by this LM client');
        }
    }

    private async askNaturalLanguage(question: string): Promise<void> {
        if (!question) {
            console.log('Usage: .ask-nl <natural language question>');
            console.log('Example: .ask-nl Is a bird an animal?');
            return;
        }
        try {
            console.log(`Asking: "${question}"`);
            const answer = await (this.nar as any).askNaturalLanguage(question);
            console.log(`\n→ ${answer}`);
        } catch (error) {
            console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private showConstitution(args: string[]): void {
        const nar = this.nar as any;
        if (args[0] === 'add' && args[1]) {
            nar.setConstitution([{
                term: args.slice(1).join(' '),
                type: 'belief' as const,
                truth: {f: 1, c: 1},
                budget: 1,
                stamp: {id: '', creationTime: Date.now(), source: 'CONSTITUTION', derivations: [], depth: 0}
            }]);
            console.log(`✓ Added to constitution: ${args.slice(1).join(' ')}`);
            return;
        }
        const constitution = nar.getConstitution?.() || [];
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Constitution (Immutable Beliefs)                ║');
        console.log('╠══════════════════════════════════════════════════╣');
        if (constitution.length === 0) {
            console.log('║ No constitution set.                             ║');
        } else {
            for (const belief of constitution.slice(0, 10)) {
                console.log(`║ ${belief.term.toString().padEnd(48)}║`);
            }
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('Usage: .constitution add <narsese-belief>');
    }

    private showAttention(): void {
        const report = (this.nar as any).attentionReport?.();
        if (!report) {
            console.log('Attention report not available');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Attention Allocation                             ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Total Concepts: ${String(report.total).padEnd(37)}║`);
        console.log('╠══════════════════════════════════════════════════╣');
        for (const c of report.concepts.slice(0, 10)) {
            console.log(`║ ${c.term.substring(0, 40).padEnd(40)} ${c.priority.toFixed(3)}║`);
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private loadDomain(args: string[]): void {
        const domains: Record<string, string[]> = {
            biology: ['<cell --> unit>.', '<organelle --> cell>.', '<DNA --> molecule>.', '<protein --> molecule>.'],
            physics: ['<force --> interaction>.', '<mass --> property>.', '<energy --> property>.', '<velocity --> rate>.'],
            mathematics: ['<number --> quantity>.', '<set --> collection>.', '<function --> mapping>.', '<proof --> reasoning>.'],
            programming: ['<function --> code>.', '<variable --> storage>.', '<algorithm --> procedure>.', '<compiler --> tool>.'],
            finance: ['<money --> value>.', '<investment --> allocation>.', '<risk --> uncertainty>.', '<profit --> gain>.']
        };

        const domain = args[0]?.toLowerCase();
        if (!domain || !domains[domain]) {
            console.log('Usage: .load-domain <domain>');
            console.log('Available domains: biology, physics, mathematics, programming, finance');
            return;
        }

        (this.nar as any).loadDomain({name: domain, beliefs: domains[domain]});
        console.log(`✓ Loaded ${domain} domain with ${domains[domain].length} beliefs`);
    }
}

export type {SeNARSCLI};

const cli = new SeNARSCLI();
cli.start();
