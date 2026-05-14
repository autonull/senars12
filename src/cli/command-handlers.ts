import type {NAR} from '../nar';
import {errMsg} from '../nar/utils/helpers.js';
import {termParser} from '../nar/terms';
import {box, showCommandHelp} from './display.js';
import {DOMAIN_LIST, DOMAINS} from './domains.js';

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

export class CommandHandlers {
    private nar: NAR;

    constructor(nar: NAR) {
        this.nar = nar;
    }

    handleCommand(input: string): void {
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
                handler();
            } catch (error) {
                console.log(`Error: ${errMsg(error)}`);
            }
        } else {
            console.log(`Unknown command: ${cmd}. Type .help for commands.`);
        }
    }

    async handleBelief(term: string): Promise<void> {
        try {
            await this.nar.input(term);
            console.log(`✓ Added: ${term}`);
        } catch (error) {
            console.log(`✗ Error: ${errMsg(error)}`);
        }
    }

    async handleQuestion(term: string): Promise<void> {
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

    private showStats(detail?: string): void {
        const stats = this.nar.getStatistics();
        const metrics = this.nar.getMetrics?.() || {};

        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║ SeNARS Statistics                                     ║');
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
            const profile = (this.nar as unknown as {profile?: {start: (n: NAR) => void; stop: (n: NAR) => void}}).profile;
            profile?.start(this.nar);
        } else if (cmd === 'stop') {
            const profile = (this.nar as unknown as {profile?: {start: (n: NAR) => void; stop: (n: NAR) => void}}).profile;
            profile?.stop(this.nar);
        }
    }

    private showSelfStatus(): void {
        const self = (this.nar as unknown as {getSelfAnalyzer?: () => unknown}).getSelfAnalyzer?.();
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
        const self = (this.nar as unknown as {getSelfAnalyzer?: () => unknown}).getSelfAnalyzer?.();
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

    private runOptimization(): void {
        const self = (this.nar as unknown as {getSelfAnalyzer?: () => unknown}).getSelfAnalyzer?.();
        if (self && (self as SelfAnalyzerRef).applyOptimizations) {
            (self as SelfAnalyzerRef).applyOptimizations?.();
            console.log('✓ Applied metacognitive optimizations');
        } else {
            console.log('Self optimization not available');
        }
        const rlfp = (this.nar as unknown as {getRLFP?: () => unknown}).getRLFP?.();
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
        const rlfp = (this.nar as unknown as {getRLFP?: () => unknown}).getRLFP?.();
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
        const rlfp = (this.nar as unknown as {getRLFP?: () => unknown}).getRLFP?.();
        const rlfpRef = rlfp as RLFPref | null;
        if (!rlfpRef) {
            console.log('RLFP not enabled');
            return;
        }
        const prefs = rlfpRef.preferences?.length ?? 0;
        console.log('\n' + box('RLFP Reward Status', [`Preferences: ${prefs}`]) + '\n');
    }

    private showRLFPStats(): void {
        const rlfp = (this.nar as unknown as {getRLFP?: () => unknown}).getRLFP?.();
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
        const lm = (this.nar as unknown as {getLMClient?: () => unknown}).getLMClient?.();
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
        const lm = (this.nar as unknown as {getLMClient?: () => unknown}).getLMClient?.();
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

    async askNaturalLanguage(question: string): Promise<void> {
        if (!question) {
            console.log('Usage: .ask-nl <natural language question>');
            console.log('Example: .ask-nl Is a bird an animal?');
            return;
        }
        try {
            console.log(`Asking: "${question}"`);
            const askNL = (this.nar as unknown as {askNaturalLanguage?: (q: string) => Promise<string>}).askNaturalLanguage;
            if (askNL) {
                const answer = await askNL(question);
                console.log(`\n→ ${answer}`);
            } else {
                console.log('Natural language query not available');
            }
        } catch (error) {
            console.log(`Error: ${errMsg(error)}`);
        }
    }

    showConstitution(args: string[]): void {
        if (args[0] === 'add' && args[1]) {
            const termStr = args.slice(1).join(' ');
            const term = termParser.parse(termStr);
            const setConstitution = (this.nar as unknown as {setConstitution?: (b: unknown[]) => void}).setConstitution;
            setConstitution?.([{
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
        const getConstitution = (this.nar as unknown as {getConstitution?: () => unknown[]}).getConstitution;
        const constitution = getConstitution?.() ?? [];
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Constitution (Immutable Beliefs)                  ║');
        console.log('╠══════════════════════════════════════════════════╣');
        if (constitution.length === 0) {
            console.log('║ No constitution set.                                ║');
        } else {
            for (const belief of constitution.slice(0, 10)) {
                const b = belief as {term: {toString: () => string}};
                console.log(`║ ${b.term.toString().padEnd(48)}║`);
            }
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('Usage: .constitution add <narsese-belief>');
    }

    showAttention(): void {
        const getAttentionReport = (this.nar as unknown as {getAttentionReport?: () => unknown}).getAttentionReport;
        const report = getAttentionReport?.() as {total?: number; concepts?: Array<{term?: string; priority?: number}>} | undefined;
        if (!report) {
            console.log('Attention report not available');
            return;
        }
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║ Attention Allocation                              ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Total Concepts: ${String(report.total).padEnd(37)}║`);
        console.log('╠══════════════════════════════════════════════════╣');
        for (const c of report.concepts?.slice(0, 10) ?? []) {
            console.log(`║ ${(c.term ?? '').substring(0, 40).padEnd(40)} ${(c.priority ?? 0).toFixed(3)}║`);
        }
        console.log('╚══════════════════════════════════════════════════╝\n');
    }

    loadDomain(args: string[]): void {
        const domain = args[0]?.toLowerCase();
        if (!domain || !DOMAINS[domain]) {
            console.log(`Usage: .load-domain <domain>`);
            console.log(`Available domains: ${DOMAIN_LIST}`);
            return;
        }

        const loadDomain = (this.nar as unknown as {loadDomain?: (d: {name: string; beliefs: string[]}) => void}).loadDomain;
        loadDomain?.({name: domain, beliefs: DOMAINS[domain]});
        console.log(`✓ Loaded ${domain} domain with ${DOMAINS[domain].length} beliefs`);
    }
}