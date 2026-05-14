import type {NAR} from '../nar';
import type {ReasoningAboutReasoning} from '../nar/self';
import type {RLFPLearner} from '../nar/rlfp';
import type {LMClient} from '../nar/lm/types.js';
import {errMsg} from '../nar/utils/helpers.js';
import {termParser} from '../nar/terms';
import {box, showStats, showCommandHelp} from './display.js';
import {DOMAIN_LIST, DOMAINS} from './domains.js';
import {createLogger} from '../nar/this.logger';

export class CommandHandlers {
    private readonly this.logger = createLogger({scope: 'CLI'});
    private nar: NAR;

    constructor(nar: NAR) {
        this.nar = nar;
    }

    private get self(): ReasoningAboutReasoning | undefined {
        return this.nar.getSelfAnalyzer();
    }

    private get rlfp(): RLFPLearner | undefined {
        return this.nar.getRLFP();
    }

    private get lm(): LMClient | undefined {
        return this.nar.getLMClient();
    }

    handleCommand(input: string): void {
        const parts = input.split(/\s+/);
        const cmd = parts[0]!;
        const args = parts.slice(1);

        const handlers: Record<string, () => void | Promise<void>> = {
            '.help': () => {
                const helpCmd = args[0];
                if (helpCmd && !showCommandHelp(helpCmd)) {
                    this.this.logger.warn(`Unknown command: ${helpCmd}. Type .help for command list.`);
                }
            },
            '.run': () => this.runInference(args[0] ? parseInt(args[0]) : 5),
            '.stats': () => showStats(this.nar, args[0]),
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
                this.this.logger.info('Goodbye!');
                process.exit(0);
            }
        };

        const handler = handlers[cmd];
        if (handler) {
            try {
                handler();
            } catch (error) {
                this.this.logger.error(`Error: ${errMsg(error)}`);
            }
        } else {
            this.this.logger.warn(`Unknown command: ${cmd}. Type .help for commands.`);
        }
    }

    async handleBelief(term: string): Promise<void> {
        try {
            await this.nar.input(term);
            this.this.logger.info(`✓ Added: ${term}`);
        } catch (error) {
            this.this.logger.error(`✗ Error: ${errMsg(error)}`);
        }
    }

    async handleQuestion(term: string): Promise<void> {
        try {
            await this.nar.question(term);
            const derived = await this.nar.run(5);

            if (derived > 0) {
                this.this.logger.info(`✓ Derived ${derived} new belief(s)`);
            } else {
                this.this.logger.info('? No derivation found');
            }
        } catch (error) {
            this.this.logger.error(`✗ Error: ${errMsg(error)}`);
        }
    }

    private async runInference(steps: number): Promise<void> {
        this.this.logger.info(`⟳ Running ${steps} step(s)...`);
        const derived = await this.nar.run(steps);
        this.this.logger.info(`✓ Completed ${steps} step(s), derived ${derived} belief(s)`);
    }

    private listConcepts(): void {
        const concepts = this.nar.listConcepts();
        if (concepts.length === 0) {
            this.this.logger.info('Memory is empty');
            return;
        }

        this.this.logger.info('\nConcepts:');
        for (const concept of concepts.slice(0, 20)) {
            this.this.logger.info(` - ${concept.term.toString()}`);
        }
        if (concepts.length > 20) {
            this.this.logger.info(` ... and ${concepts.length - 20} more`);
        }
        this.this.logger.info('');
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
            this.this.logger.info(filter ? `No concepts matching '${filter}'` : 'Memory is empty');
            return;
        }

        this.this.logger.info(`\nConcepts (${filtered.length} total):`);
        for (const concept of filtered.slice(0, 50)) {
            this.this.logger.info(` ${concept.term.toString()}`);
        }
        if (filtered.length > 50) {
            this.this.logger.info(` ... and ${filtered.length - 50} more`);
        }
        this.this.logger.info('');
    }

    private showRules(_filter?: string): void {
        this.this.logger.info('\nRegistered Rules:');
        this.this.logger.info(' (Rules are defined in RuleProcessor)');
        this.this.logger.info(' - deduction: (A --> B), (B --> C) => (A --> C)');
        this.this.logger.info(' - induction: (A --> B), (A --> C) => (C --> B)');
        this.this.logger.info(' - abduction: (A --> C), (B --> C) => (A --> B)');
        this.this.logger.info(' - revision: Merge conflicting beliefs');
        this.this.logger.info(' - LM rules: Dynamic language model inference');
        this.this.logger.info('');
    }

    private showTools(filter?: string): void {
        this.this.logger.info('\nAvailable Tools:');
        const tools = this.nar.listTools();

        const filtered = filter
            ? tools.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
            : tools;

        for (const tool of filtered) {
            this.this.logger.info(` - ${tool.name}: ${tool.description}`);
        }
        this.this.logger.info('');
    }

    private handleConfig(args: string[]): void {
        if (args.length === 0) {
            const config = this.nar.getConfig();
            this.this.logger.info('\nCurrent Configuration:');
            for (const [key, value] of Object.entries(config)) {
                this.this.logger.info(` ${key}: ${String(value)}`);
            }
            this.this.logger.info('');
            return;
        }

        if (args.length === 1) {
            const config = this.nar.getConfig();
            const value = config[args[0] as keyof typeof config];
            this.this.logger.info(`${args[0]}: ${String(value ?? 'unknown')}`);
            return;
        }

        if (args.length === 2) {
            const [key, value] = args;
            const typedValue = isNaN(Number(value)) ? value : Number(value);
            this.nar.setConfig({[key!]: typedValue});
            this.this.logger.info(`Set ${key} to ${typedValue}`);
        }
    }

    private clearMemory(): void {
        this.nar.clearMemory();
        this.this.logger.info('✓ Memory cleared');
    }

    private async loadFile(filename: string | undefined): Promise<void> {
        if (!filename) {
            this.this.logger.info('Usage: .load <filename>');
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

        this.this.logger.info(`✓ Loaded ${loaded} belief(s) from ${filename}`);
    }

    private async saveMemory(filename: string | undefined): Promise<void> {
        if (!filename) {
            this.this.logger.info('Usage: .save <filename>');
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
        this.this.logger.info(`✓ Saved ${concepts.length} concept(s) to ${filename}`);
    }

    private async queryTerm(termStr: string): Promise<void> {
        if (!termStr) {
            this.this.logger.info('Usage: .query <term>');
            return;
        }

        try {
            const beliefs = this.nar.getBeliefs();
            const goals = this.nar.getGoals();
            const questions = this.nar.getQuestions();

            this.this.logger.info('\nQuery Results:');
            this.this.logger.info(`Beliefs: ${beliefs.length}`);
            this.this.logger.info(`Goals: ${goals.length}`);
            this.this.logger.info(`Questions: ${questions.length}`);

            const all = [...beliefs, ...goals, ...questions];
            if (all.length > 0) {
                this.this.logger.info('\nMatches:');
                all.slice(0, 10).forEach(item => {
                    const truthStr = item.truth ? ` f=${item.truth.f.toFixed(2)} c=${item.truth.c.toFixed(2)}` : '';
                    this.this.logger.info(` ${item.term.toString()} [${item.type}]${truthStr}`);
                });
                if (all.length > 10) {
                    this.this.logger.info(` ... and ${all.length - 10} more`);
                }
            }
        } catch (error) {
            this.this.logger.error(`Query error: ${errMsg(error)}`);
        }
    }

    private async traceTerm(termStr: string): Promise<void> {
        if (!termStr) {
            this.this.logger.info('Usage: .trace <term>');
            return;
        }

        try {
            const beliefs = this.nar.getBeliefs({contains: termStr});

            if (beliefs.length === 0) {
                this.this.logger.info(`No beliefs found for: ${termStr}`);
                return;
            }

            const matchingConcept = this.nar.listConcepts().find(c => c.term.toString().includes(termStr));
            const term = matchingConcept?.term;
            if (!term) {
                this.this.logger.info(`No term found for: ${termStr}`);
                return;
            }
            const trace = this.nar.traceTerm(term);
            const traceData = trace;

            if (!traceData || (Array.isArray(traceData) ? traceData.length : 0) === 0) {
                this.this.logger.info(`No derivation trace found for: ${termStr}`);
                return;
            }

            const traceArray = Array.isArray(traceData) ? traceData : [traceData];

            this.this.logger.info('\nDerivation Trace:');
            traceArray.slice(-10).forEach((step, index) => {
                const stepRef = step as {stamp?: {source?: string; derivations?: unknown[]}; term?: {toString?: () => string}};
                const source = stepRef.stamp?.source || stepRef.stamp?.derivations ? 'DERIVED' : 'INPUT';
                const termStr = stepRef.term?.toString?.() ?? 'unknown';
                this.this.logger.info(`${index + 1}. ${termStr} [${source}]`);
            });

            if (traceArray.length > 10) {
                this.this.logger.info(` ... and ${traceArray.length - 10} more steps`);
            }
        } catch (error) {
            this.this.logger.error(`Trace error: ${errMsg(error)}`);
        }
    }

    private async explainTerm(termStr: string): Promise<void> {
        if (!termStr) {
            this.this.logger.info('Usage: .explain <term>');
            return;
        }

        try {
            const beliefs = this.nar.getBeliefs({contains: termStr});

            if (beliefs.length === 0) {
                this.this.logger.info(`No beliefs found for: ${termStr}`);
                return;
            }

            const topBelief = beliefs[0]!;
            const explanation = this.nar.explain(topBelief);

            this.this.logger.info('\nExplanation:');
            this.this.logger.info(`Term: ${topBelief.term.toString()}`);
            this.this.logger.info(`Type: ${topBelief.type}`);
            this.this.logger.info(`Truth: f=${topBelief.truth.f.toFixed(2)}, c=${topBelief.truth.c.toFixed(2)}`);
            this.this.logger.info(`Source: ${topBelief.stamp?.source || 'DERIVED'}`);

            if (explanation) {
                this.this.logger.info('\nDerivation path:');
                if (Array.isArray(explanation)) {
                    explanation.slice(-5).forEach((step, i) => {
                        this.this.logger.info(` ${i + 1}. ${typeof step === 'string' ? step : step.toString()}`);
                    });
                } else {
                    this.this.logger.info(` ${explanation}`);
                }
            } else {
                this.this.logger.info(' (No derivation path available)');
            }
        } catch (error) {
            this.this.logger.error(`Explain error: ${errMsg(error)}`);
        }
    }

    private showSelfStatus(): void {
        const self = this.self;
        if (!self) {
            this.this.logger.info('Self/Metacognition is not enabled');
            return;
        }
        const isRunning = self.isRunning ?? false;
        const analysis = self.getSystemAnalysis?.();
        const lines = [
            `Running: ${isRunning ? 'Yes' : 'No'}`,
            ...analysis ? [
                `Cycles: ${String((analysis as { cycleCount?: number }).cycleCount ?? 'N/A')}`,
                `Strategies: ${String((analysis as { strategies?: unknown[] }).strategies?.length ?? 0)}`
            ] : []
        ];
        this.this.logger.info('\n' + box('Self/Metacognition Status', lines) + '\n');
    }

    private showMetaAnalysis(): void {
        const self = this.self;
        if (!self) {
            this.this.logger.info('Self/Metacognition is not enabled');
            return;
        }
        const analysis = self.getSystemAnalysis?.();
        if (!analysis) {
            this.this.logger.info('No analysis available yet');
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
        this.this.logger.info('\n' + box('Meta-Analysis Report', lines) + '\n');
    }

    private runOptimization(): void {
        const self = this.self;
        if (self?.applyOptimizations) {
            self.applyOptimizations();
            this.this.logger.info('✓ Applied metacognitive optimizations');
        } else {
            this.this.logger.info('Self optimization not available');
        }
        const rlfp = this.rlfp;
        if (rlfp?.optimize) {
            rlfp.optimize();
            this.this.logger.info('✓ RLFP policy optimized');
        }
    }

    private handlePrefer(args: string[]): void {
        if (args.length < 2) {
            this.this.logger.info('Usage: .prefer <prefered> <rejected>');
            return;
        }
        const rlfp = this.rlfp;
        if (!rlfp) {
            this.this.logger.info('RLFP not enabled');
            return;
        }
        const [preferred, rejected] = [args[0]!, args[1]!];
        rlfp.addPreference?.(preferred, rejected);
        this.this.logger.info(`✓ Preference recorded: ${preferred} > ${rejected}`);
    }

    private showRewardStatus(): void {
        const rlfp = this.rlfp;
        if (!rlfp) {
            this.this.logger.info('RLFP not enabled');
            return;
        }
        this.this.logger.info('\n' + box('RLFP Reward Status', [`Preferences: ${rlfp.preferences?.length ?? 0}`]) + '\n');
    }

    private showRLFPStats(): void {
        const rlfp = this.rlfp;
        if (!rlfp) {
            this.this.logger.info('RLFP not enabled');
            return;
        }
        this.this.logger.info('\n' + box('RLFP Statistics', [
            `Preferences: ${String(rlfp.preferences?.length ?? 0)}`,
            `Trajectories: ${String(rlfp.trajectoryCount ?? 0)}`,
            `Last Optimization: ${rlfp.lastOptimizeTime ? new Date(rlfp.lastOptimizeTime).toLocaleTimeString() : 'Never'}`
        ]) + '\n');
    }

    private showLMStatus(): void {
        const lm = this.lm;
        if (!lm) {
            this.this.logger.info('LM client not configured');
            return;
        }
        this.logger.info('\n' + box('LM Status', [
            `Provider: ${String(lm.provider ?? 'unknown')}`,
            `Model: ${String(lm.model ?? 'unknown')}`,
            `Available: ${lm.available ? 'Yes' : 'No'}`
        ]) + '\n');
    }

    private switchLMModel(model: string | undefined): void {
        if (!model) {
            this.this.logger.info('Usage: .lm-switch <model-name>');
            return;
        }
        const lm = this.lm;
        if (!lm) {
            this.this.logger.info('LM client not configured');
            return;
        }
        if (lm.setModel) {
            lm.setModel(model);
            this.this.logger.info(`✓ Switched to model: ${model}`);
        } else {
            this.this.logger.info('Model switching not supported by this LM client');
        }
    }

    async askNaturalLanguage(question: string): Promise<void> {
        if (!question) {
            this.this.logger.info('Usage: .ask-nl <natural language question>');
            this.this.logger.info('Example: .ask-nl Is a bird an animal?');
            return;
        }
        try {
            this.this.logger.info(`Asking: "${question}"`);
            const askNL = (this.nar).askNaturalLanguage?.(question);
            if (askNL) {
                const answer = await askNL;
                this.this.logger.info(`\n→ ${answer}`);
            } else {
                this.this.logger.info('Natural language query not available');
            }
        } catch (error) {
            this.this.logger.error(`Error: ${errMsg(error)}`);
        }
    }

    showConstitution(args: string[]): void {
        if (args[0] === 'add' && args[1]) {
            const termStr = args.slice(1).join(' ');
            const term = termParser.parse(termStr);
            this.nar.setConstitution?.([{
                term,
                type: 'belief' as const,
                truth: {f: 1, c: 1},
                budget: {priority: 1, durability: 1, quality: 1, cycles: 0, depth: 0},
                stamp: {id: '', creationTime: Date.now(), source: 'CONSTITUTION' as const, derivations: [], depth: 0},
                occurrenceTime: Date.now(),
                derived: false
            }]);
            this.this.logger.info(`✓ Added to constitution: ${termStr}`);
            return;
        }
        const constitution = this.nar.getConstitution?.() ?? [];
        const lines = constitution.length === 0
            ? ['No constitution set.']
            : constitution.slice(0, 10).map(b => b.term.toString());
        this.logger.info('\n' + box('Constitution (Immutable Beliefs)', lines) + '\n');
        this.this.logger.info('Usage: .constitution add <narsese-belief>');
    }

    showAttention(): void {
        const report = this.nar.getAttentionReport?.();
        if (!report) {
            this.this.logger.info('Attention report not available');
            return;
        }
        const lines = [`Total Concepts: ${String(report.total)}`, ...(report.concepts?.slice(0, 10).map(c =>
            `${(c.term ?? '').substring(0, 40).padEnd(40)} ${(c.priority ?? 0).toFixed(3)}`
        ) ?? [])];
        this.logger.info('\n' + box('Attention Allocation', lines) + '\n');
    }

    loadDomain(args: string[]): void {
        const domain = args[0]?.toLowerCase();
        if (!domain || !DOMAINS[domain]) {
            this.this.logger.info(`Usage: .load-domain <domain>`);
            this.this.logger.info(`Available domains: ${DOMAIN_LIST}`);
            return;
        }

        this.nar.loadDomain?.({name: domain, beliefs: DOMAINS[domain]});
        this.this.logger.info(`✓ Loaded ${domain} domain with ${DOMAINS[domain].length} beliefs`);
    }
}