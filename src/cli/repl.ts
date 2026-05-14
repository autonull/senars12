/**
 * SeNARS CLI REPL
 * Interactive terminal interface for neuro-symbolic reasoning
 */

import {NAR, SeNARSFactory} from '../nar';
import {createInterface, Interface} from 'readline';
import {HistoryManager} from './history';
import {ProfileManager} from './profile';
import {listConcepts, showCommandHelp, showStats} from './display';
import {DOMAIN_LIST, DOMAINS} from './domains';
import {errMsg} from '../nar/utils/helpers.js';

const _MAX_HISTORY = 1000;

interface CLIConfig {
    maxConcepts: number;
    maxDerivationDepth: number;
    showDerivations: boolean;
}

class SeNARSCLI {
    private readonly nar: NAR;
    private config: CLIConfig;
    private rl: Interface;
    private history: HistoryManager;
    private profile: ProfileManager;
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

        this.history = new HistoryManager();
        this.profile = new ProfileManager();

        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'senars> ',
            completer: this.completer.bind(this) as any
        });

        this.setupHandlers();
    }

    start(): void {
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ SeNARS CLI REPL v1.0                             ║');
        console.log('║ Neuro-Symbolic Reasoning System                  ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\nType .help for commands, .quit to exit\n');
        this.rl.prompt();
    }

    private readonly box = (title: string, lines: string[]): string => {
        const width = Math.max(title.length + 4, ...lines.map(l => l.length + 4), 50);
        const h = '═'.repeat(width - 2);
        return `╔${h}╗\n║ ${title.padEnd(width - 3)}║\n╠${h}╣\n${lines.map(l => `║ ${l.padEnd(width - 3)}║`).join('\n')}\n╚${h}╝`;
    };

    private readonly withError = async (fn: () => Promise<void>, fallback: string): Promise<void> => {
        try {
            await fn();
        } catch (error) {
            console.log(`Error: ${errMsg(error)}`);
        }
    };

    private setupHandlers(): void {
        this.rl.on('line', async (line) => {
            if (this.inMultiLine) {
                if (line.trim() === '.') {
                    this.inMultiLine = false;
                    const input = this.multiLineBuffer.join('\n');
                    this.multiLineBuffer = [];
                    this.history.add(input);
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
                this.history.add(trimmed);
                await this.processInput(trimmed);
            }
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            this.history.saveHistory();
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

    private async processInput(input: string): Promise<void> {
        if (!input || input.trim().length === 0) {
            return;
        }

        const trimmed = input.trim();

        if (trimmed.startsWith('.')) {
            await this.handleCommand(trimmed);
        } else if (trimmed === '.') {
            console.log('Multi-line input cancelled');
            this.inMultiLine = false;
            this.multiLineBuffer = [];
        } else if (trimmed.startsWith('{')) {
            this.inMultiLine = true;
            this.multiLineBuffer = [trimmed.slice(1)];
            console.log('> Multi-line input started (end with "." on empty line)');
        } else if (trimmed.endsWith('?')) {
            await this.handleQuestion(trimmed.slice(0, -1).trim());
        } else if (trimmed.endsWith('.')) {
            await this.handleBelief(trimmed.slice(0, -1).trim());
        } else {
            console.log('Syntax: (term). for beliefs, (term)? for questions, or .help');
        }
    }

    private async handleCommand(input: string): Promise<void> {
        const parts = input.split(/\s+/);
        const cmd = parts[0]!;
        const args = parts.slice(1);

        const handlers: Record<string, () => void | Promise<void>> = {
            '.help': () => {
                const helpCmd = args[0];
                if (helpCmd && !showCommandHelp(helpCmd)) {
                    console.log(`Unknown command: ${helpCmd}. Type .help for command list.`);
                }
            },
            '.run': () => this.runInference(args[0] ? parseInt(args[0]) : 5),
            '.stats': () => showStats(this.nar, args[0]),
            '.list': () => listConcepts(this.nar),
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
                console.log(`Error: ${errMsg(error)}`);
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
            console.log(`✗ Error: ${errMsg(error)}`);
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
            console.log(`✗ Error: ${errMsg(error)}`);
        }
    }

    private async runInference(steps: number): Promise<void> {
        console.log(`⟳ Running ${steps} step(s)...`);
        const derived = await this.nar.run(steps);
        console.log(`✓ Completed ${steps} step(s), derived ${derived} belief(s)`);
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
            console.log(` ${concept.term.toString()}`);
        }
        if (filtered.length > 50) {
            console.log(` ... and ${filtered.length - 50} more`);
        }
        console.log();
    }

    private showRules(_filter?: string): void {
        console.log('\nRegistered Rules:');
        console.log(' (Rules are defined in RuleProcessor)');
        console.log(' - deduction: (A --> B), (B --> C) => (A --> C)');
        console.log(' - induction: (A --> B), (A --> C) => (C --> B)');
        console.log(' - abduction: (A --> C), (B --> C) => (A --> B)');
        console.log(' - revision: Merge conflicting beliefs');
        console.log(' - LM rules: Dynamic language model inference');
        console.log();
    }

    private showTools(filter?: string): void {
        console.log('\nAvailable Tools:');
        const tools = this.nar.listTools();

        const filtered = filter
            ? tools.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
            : tools;

        for (const tool of filtered) {
            console.log(` - ${tool.name}: ${tool.description}`);
        }
        console.log();
    }

    private handleConfig(args: string[]): void {
        if (args.length === 0) {
            const config = this.nar.getConfig();
            console.log('\nCurrent Configuration:');
            for (const [key, value] of Object.entries(config)) {
                console.log(` ${key}: ${String(value)}`);
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

        const content = await import('fs').then(fs => fs.promises.readFile(filename, 'utf-8'));
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

        const fs = await import('fs');
        await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
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
                    console.log(` ${item.term.toString()} [${item.type}]${truthStr}`);
                });
                if (all.length > 10) {
                    console.log(` ... and ${all.length - 10} more`);
                }
            }
        } catch (error) {
            console.log(`Query error: ${errMsg(error)}`);
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
                console.log(` ... and ${traceArray.length - 10} more steps`);
            }
        } catch (error) {
            console.log(`Trace error: ${errMsg(error)}`);
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
                        console.log(` ${i + 1}. ${typeof step === 'string' ? step : step.toString()}`);
                    });
                } else {
                    console.log(` ${explanation}`);
                }
            } else {
                console.log(' (No derivation path available)');
            }
        } catch (error) {
            console.log(`Explain error: ${errMsg(error)}`);
        }
    }

    private handleProfile(args: string[]): void {
        const cmd = args[0];

        if (cmd === 'start' || !cmd) {
            this.profile.start(this.nar);
        } else if (cmd === 'stop') {
            this.profile.stop(this.nar);
        }
    }

    private showSelfStatus(): void {
        const self = this.nar.getSelfAnalyzer();
        if (!self) {
            console.log('Self/Metacognition is not enabled');
            return;
        }
        const isRunning = (self as { isRunning?: boolean }).isRunning ?? false;
        const analysis = (self as { getSystemAnalysis?: () => unknown }).getSystemAnalysis?.();
        const lines = [
            `Running: ${isRunning ? 'Yes' : 'No'}`,
            ...analysis ? [
                `Cycles: ${String((analysis as { cycleCount?: number }).cycleCount ?? 'N/A')}`,
                `Strategies: ${String((analysis as { strategies?: unknown[] }).strategies?.length ?? 0)}`
            ] : []
        ];
        console.log('\n' + this.box('Self/Metacognition Status', lines) + '\n');
    }

    private showMetaAnalysis(): void {
        const self = this.nar.getSelfAnalyzer();
        if (!self) {
            console.log('Self/Metacognition is not enabled');
            return;
        }
        const analysis = (self as { getSystemAnalysis?: () => unknown }).getSystemAnalysis?.();
        if (!analysis) {
            console.log('No analysis available yet');
            return;
        }
        const lines: string[] = [
            `Cycle Count: ${String((analysis as { cycleCount?: number }).cycleCount ?? 0)}`
        ];
        const reasoningQuality = (analysis as { reasoningQuality?: number }).reasoningQuality;
        if (reasoningQuality) {
            lines.push(`Reasoning Quality: ${reasoningQuality.toFixed(2)}`);
        }
        const strategies = (analysis as { strategies?: Array<{ name?: string; efficiency?: number }> }).strategies;
        if (strategies?.length) {
            lines.push('Strategy Performance:');
            for (const s of strategies.slice(0, 3)) {
                lines.push(` - ${s.name || 'unknown'}: ${s.efficiency?.toFixed(2) ?? 'N/A'}`);
            }
        }
        console.log('\n' + this.box('Meta-Analysis Report', lines) + '\n');
    }

    private async runOptimization(): Promise<void> {
        const self = this.nar.getSelfAnalyzer();
        if (self && (self as any).applyOptimizations) {
            (self as any).applyOptimizations();
            console.log('✓ Applied metacognitive optimizations');
        } else {
            console.log('Self optimization not available');
        }
        const rlfp = this.nar.getRLFP();
        if (rlfp && (rlfp as any).optimize) {
            (rlfp as any).optimize();
            console.log('✓ RLFP policy optimized');
        }
    }

    private handlePrefer(args: string[]): void {
        if (args.length < 2) {
            console.log('Usage: .prefer <prefered> <rejected>');
            return;
        }
        const rlfp = this.nar.getRLFP();
        if (!rlfp) {
            console.log('RLFP not enabled');
            return;
        }
        (rlfp as any).addPreference(args[0], args[1]);
        console.log(`✓ Preference recorded: ${args[0]} > ${args[1]}`);
    }

    private showRewardStatus(): void {
        const rlfp = this.nar.getRLFP();
        if (!rlfp) {
            console.log('RLFP not enabled');
            return;
        }
        const prefs = (rlfp as { preferences?: unknown[] }).preferences?.length ?? 0;
        console.log('\n' + this.box('RLFP Reward Status', [`Preferences: ${prefs}`]) + '\n');
    }

    private showRLFPStats(): void {
        const rlfp = this.nar.getRLFP();
        if (!rlfp) {
            console.log('RLFP not enabled');
            return;
        }
        const rlfpAny = rlfp as { preferences?: unknown[]; trajectoryCount?: number; lastOptimizeTime?: number };
        console.log('\n' + this.box('RLFP Statistics', [
            `Preferences: ${String(rlfpAny.preferences?.length ?? 0)}`,
            `Trajectories: ${String(rlfpAny.trajectoryCount ?? 0)}`,
            `Last Optimization: ${rlfpAny.lastOptimizeTime ? new Date(rlfpAny.lastOptimizeTime).toLocaleTimeString() : 'Never'}`
        ]) + '\n');
    }

    private showLMStatus(): void {
        const lm = this.nar.getLMClient();
        if (!lm) {
            console.log('LM client not configured');
            return;
        }
        const lmAny = lm as { provider?: string; model?: string; available?: boolean };
        console.log('\n' + this.box('LM Status', [
            `Provider: ${String(lmAny.provider ?? 'unknown')}`,
            `Model: ${String(lmAny.model ?? 'unknown')}`,
            `Available: ${lmAny.available ? 'Yes' : 'No'}`
        ]) + '\n');
    }

    private switchLMModel(model: string | undefined): void {
        if (!model) {
            console.log('Usage: .lm-switch <model-name>');
            return;
        }
        const lm = this.nar.getLMClient();
        if (!lm) {
            console.log('LM client not configured');
            return;
        }
        if ((lm as any).setModel) {
            (lm as any).setModel(model);
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
            console.log(`Error: ${errMsg(error)}`);
        }
    }

    private showConstitution(args: string[]): void {
        if (args[0] === 'add' && args[1]) {
            (this.nar as any).setConstitution([{
                term: args.slice(1).join(' '),
                type: 'belief' as const,
                truth: {f: 1, c: 1},
                budget: 1,
                stamp: {id: '', creationTime: Date.now(), source: 'CONSTITUTION', derivations: [], depth: 0}
            }]);
            console.log(`✓ Added to constitution: ${args.slice(1).join(' ')}`);
            return;
        }
        const constitution = (this.nar as any).getConstitution?.() || [];
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Constitution (Immutable Beliefs)                  ║');
        console.log('╠══════════════════════════════════════════════════╣');
        if (constitution.length === 0) {
            console.log('║ No constitution set.                                ║');
        } else {
            for (const belief of constitution.slice(0, 10)) {
                console.log(`║ ${belief.term.toString().padEnd(48)}║`);
            }
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('Usage: .constitution add <narsese-belief>');
    }

    private showAttention(): void {
        const report = this.nar.getAttentionReport?.();
        if (!report) {
            console.log('Attention report not available');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Attention Allocation                              ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Total Concepts: ${String(report.total).padEnd(37)}║`);
        console.log('╠══════════════════════════════════════════════════╣');
        for (const c of report.concepts.slice(0, 10)) {
            console.log(`║ ${c.term.substring(0, 40).padEnd(40)} ${c.priority.toFixed(3)}║`);
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    private loadDomain(args: string[]): void {
        const domain = args[0]?.toLowerCase();
        if (!domain || !DOMAINS[domain]) {
            console.log(`Usage: .load-domain <domain>`);
            console.log(`Available domains: ${DOMAIN_LIST}`);
            return;
        }

        (this.nar as any).loadDomain({name: domain, beliefs: DOMAINS[domain]});
        console.log(`✓ Loaded ${domain} domain with ${DOMAINS[domain].length} beliefs`);
    }
}

export type {SeNARSCLI};

const cli = new SeNARSCLI();
cli.start();
