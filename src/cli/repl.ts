/**
 * SeNARS CLI REPL
 * Interactive terminal interface for neuro-symbolic reasoning
 */

import {NAR, SeNARSFactory} from '../nar';
import {createInterface, Interface} from 'readline';
import {HistoryManager} from './history';
import {ProfileManager} from './profile';
import {box, listConcepts, showCommandHelp, showStats} from './display';
import {DOMAIN_LIST, DOMAINS} from './domains';
import {errMsg} from '../nar/utils/helpers.js';
import {termParser} from '../nar/terms';

const _MAX_HISTORY = 1000;

interface CLIConfig {
    maxConcepts: number;
    maxDerivationDepth: number;
    showDerivations: boolean;
}

type NARRef = NAR & {
    askNaturalLanguage(question: string): Promise<string>;
    setConstitution(beliefs: import('../nar/types').Task[]): void;
    getConstitution(): import('../nar/types').Task[];
    loadDomain(domain: { name: string; beliefs: string[] }): void;
};

interface SelfAnalyzerRef {
    isRunning?: boolean;
    getSystemAnalysis?(): unknown;
    applyOptimizations?(): void;
}

interface RLFPref {
    preferences?: unknown[];
    trajectoryCount?: number;
    lastOptimizeTime?: number;
    addPreference?(preferred: string, rejected: string): void;
    optimize?(): void;
}

interface LMClientRef {
    provider?: string;
    model?: string;
    available?: boolean;
    setModel?(model: string): void;
}

class SeNARSCLI {
    private readonly nar: NARRef;
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
        }) as NARRef;

        this.history = new HistoryManager();
        this.profile = new ProfileManager();

        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'senars> ',
            completer: (line: string): [string[], string] => this.completer(line)
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
        if (!input?.trim()) {
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
            this.nar.setConfig({[key!]: typedValue});
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

            const matchingConcept = this.nar.listConcepts().find(c => c.term.toString().includes(termStr));
            const term = matchingConcept?.term;
            if (!term) {
                console.log(`No term found for: ${termStr}`);
                return;
            }
            const trace = this.nar.traceTerm(term);
            const traceData = trace;

            if (!traceData || (Array.isArray(traceData) ? traceData.length : 0) === 0) {
                console.log(`No derivation trace found for: ${termStr}`);
                return;
            }

            const traceArray = Array.isArray(traceData) ? traceData : [traceData];

            console.log('\nDerivation Trace:');
            traceArray.slice(-10).forEach((step, index) => {
                const stepRef = step as {stamp?: {source?: string; derivations?: unknown[]}; term?: {toString?: () => string}};
                const source = stepRef.stamp?.source || stepRef.stamp?.derivations ? 'DERIVED' : 'INPUT';
                const termStr = stepRef.term?.toString?.() ?? 'unknown';
                console.log(`${index + 1}. ${termStr} [${source}]`);
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
            const explanation = this.nar.explain(topBelief);

            console.log('\nExplanation:');
            console.log(`Term: ${topBelief.term.toString()}`);
            console.log(`Type: ${topBelief.type}`);
            console.log(`Truth: f=${topBelief.truth.f.toFixed(2)}, c=${topBelief.truth.c.toFixed(2)}`);
            console.log(`Source: ${topBelief.stamp?.source || 'DERIVED'}`);

            if (explanation) {
                console.log('\nDerivation path:');
                if (Array.isArray(explanation)) {
                    explanation.slice(-5).forEach((step, i) => {
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
        const selfRef = self as SelfAnalyzerRef;
        const isRunning = selfRef.isRunning ?? false;
        const analysis = selfRef.getSystemAnalysis?.();
        const lines = [
            `Running: ${isRunning ? 'Yes' : 'No'}`,
            ...analysis ? [
                `Cycles: ${String((analysis as { cycleCount?: number }).cycleCount ?? 'N/A')}`,
                `Strategies: ${String((analysis as { strategies?: unknown[] }).strategies?.length ?? 0)}`
            ] : []
        ];
        console.log('\n' + box('Self/Metacognition Status', lines) + '\n');
    }

    private showMetaAnalysis(): void {
        const self = this.nar.getSelfAnalyzer();
        if (!self) {
            console.log('Self/Metacognition is not enabled');
            return;
        }
        const selfRef = self as SelfAnalyzerRef;
        const analysis = selfRef.getSystemAnalysis?.();
        if (!analysis) {
            console.log('No analysis available yet');
            return;
        }
        const analysisData = analysis as { cycleCount?: number; reasoningQuality?: number; strategies?: Array<{ name?: string; efficiency?: number }> };
        const lines: string[] = [
            `Cycle Count: ${String(analysisData.cycleCount ?? 0)}`
        ];
        const reasoningQuality = analysisData.reasoningQuality;
        if (reasoningQuality) {
            lines.push(`Reasoning Quality: ${reasoningQuality.toFixed(2)}`);
        }
        const strategies = analysisData.strategies;
        if (strategies?.length) {
            lines.push('Strategy Performance:');
            for (const s of strategies.slice(0, 3)) {
                lines.push(` - ${s.name || 'unknown'}: ${s.efficiency?.toFixed(2) ?? 'N/A'}`);
            }
        }
        console.log('\n' + box('Meta-Analysis Report', lines) + '\n');
    }

    private async runOptimization(): Promise<void> {
        const self = this.nar.getSelfAnalyzer();
        if (self && (self as SelfAnalyzerRef).applyOptimizations) {
            (self as SelfAnalyzerRef).applyOptimizations?.();
            console.log('✓ Applied metacognitive optimizations');
        } else {
            console.log('Self optimization not available');
        }
        const rlfp = this.nar.getRLFP();
        const rlfpRef = rlfp as RLFPref | null;
        if (rlfpRef?.optimize) {
            rlfpRef.optimize();
            console.log('✓ RLFP policy optimized');
        }
    }

    private handlePrefer(args: string[]): void {
        if (args.length < 2) {
            console.log('Usage: .prefer <prefered> <rejected>');
            return;
        }
        const rlfp = this.nar.getRLFP();
        const rlfpRef = rlfp as RLFPref | null;
        if (!rlfpRef) {
            console.log('RLFP not enabled');
            return;
        }
        const preferred = args[0]!;
        const rejected = args[1]!;
        rlfpRef.addPreference?.(preferred, rejected);
        console.log(`✓ Preference recorded: ${preferred} > ${rejected}`);
    }

    private showRewardStatus(): void {
        const rlfp = this.nar.getRLFP();
        const rlfpRef = rlfp as RLFPref | null;
        if (!rlfpRef) {
            console.log('RLFP not enabled');
            return;
        }
        const prefs = rlfpRef.preferences?.length ?? 0;
        console.log('\n' + box('RLFP Reward Status', [`Preferences: ${prefs}`]) + '\n');
    }

    private showRLFPStats(): void {
        const rlfp = this.nar.getRLFP();
        const rlfpRef = rlfp as RLFPref | null;
        if (!rlfpRef) {
            console.log('RLFP not enabled');
            return;
        }
        console.log('\n' + box('RLFP Statistics', [
            `Preferences: ${String(rlfpRef.preferences?.length ?? 0)}`,
            `Trajectories: ${String(rlfpRef.trajectoryCount ?? 0)}`,
            `Last Optimization: ${rlfpRef.lastOptimizeTime ? new Date(rlfpRef.lastOptimizeTime).toLocaleTimeString() : 'Never'}`
        ]) + '\n');
    }

    private showLMStatus(): void {
        const lm = this.nar.getLMClient();
        if (!lm) {
            console.log('LM client not configured');
            return;
        }
        const lmRef = lm as LMClientRef;
        console.log('\n' + box('LM Status', [
            `Provider: ${String(lmRef.provider ?? 'unknown')}`,
            `Model: ${String(lmRef.model ?? 'unknown')}`,
            `Available: ${lmRef.available ? 'Yes' : 'No'}`
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
        const lmRef = lm as LMClientRef;
        if (lmRef.setModel) {
            lmRef.setModel(model);
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
            const answer = await this.nar.askNaturalLanguage(question);
            console.log(`\n→ ${answer}`);
        } catch (error) {
            console.log(`Error: ${errMsg(error)}`);
        }
    }

    private showConstitution(args: string[]): void {
        if (args[0] === 'add' && args[1]) {
            const termStr = args.slice(1).join(' ');
            const term = termParser.parse(termStr);
            this.nar.setConstitution([{
                term,
                type: 'belief' as const,
                truth: {f: 1, c: 1},
                budget: {priority: 1, durability: 1, quality: 1, cycles: 0, depth: 0},
                stamp: {id: '', creationTime: Date.now(), source: 'CONSTITUTION' as const, derivations: [], depth: 0},
                occurrenceTime: Date.now(),
                derived: false
            }]);
            console.log(`✓ Added to constitution: ${termStr}`);
            return;
        }
        const constitution = this.nar.getConstitution();
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

        this.nar.loadDomain({name: domain, beliefs: DOMAINS[domain]});
        console.log(`✓ Loaded ${domain} domain with ${DOMAINS[domain].length} beliefs`);
    }
}

export type {SeNARSCLI};

const cli = new SeNARSCLI();
cli.start();
