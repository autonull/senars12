import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {ModelRunner} from './model/ModelRunner.js';
import {route, type Route} from './routing.js';
import {recordRoute, recordTool, getPolicy} from './services/metrics.js';
import {createNARSTools, createGeneralTools} from '../nar/tools/adapters/index.js';

export interface ConversationEntry {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface EpisodeRecord {
    id: string;
    input: string;
    response: string;
    concepts: string[];
    routeKind: string;
    timestamp: number;
}

export interface AIAgentOptions {
    nar?: NAR;
    lm?: LMClient;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    maxLoops?: number;
    systemInstructions?: string;
}

const SYSTEM_PROMPT = 'You are SeNARS — a neurosymbolic cognitive kernel. ' +
    'Call nar_believe or nar_query when formal logic is needed.';

const MAX_HISTORY = 40;
const MAX_PINNED = 8;
const MAX_EPISODES = 256;
const MAX_CONCEPT_SLICE = 10;
const MAX_QUESTION_SLICE = 5;

export class AIAgent {
    private readonly nar?: NAR;
    private readonly lm?: LMClient;
    private readonly runner: ModelRunner;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly systemInstructions: string;
    private history: ConversationEntry[] = [];
    private pinned: string[] = [];
    private episodeLog: EpisodeRecord[] = [];

    constructor(opts: AIAgentOptions = {}) {
        this.nar = opts.nar;
        this.lm = opts.lmClient ?? opts.lm;
        this.episodicMemory = opts.episodicMemory;
        this.systemInstructions = opts.systemInstructions ?? SYSTEM_PROMPT;
        this.runner = new ModelRunner({
            lmClient: this.lm,
            maxLoops: opts.maxLoops ?? 5,
        });
    }

    async chat(input: string): Promise<string> {
        const r = route(input);
        recordRoute(r.kind);
        this.episodicMemory?.log('input', input).catch(() => {});

        if (r.kind === 'narsese-belief' && r.narsese) return this.handleBelief(input, r.narsese);
        if (r.kind === 'narsese-question') return this.handleQuestion(input, r);
        if (r.kind === 'command') return this.handleCommand(input, r);

        return this.handleNL(input);
    }

    private async handleBelief(input: string, statement: string): Promise<string> {
        await this.nar?.input(statement, 'belief');
        await this.nar?.run(5);
        const text = `+ ${statement}`;
        this.recordToolsFor('nar_believe');
        this.logEpisode(input, text, [statement], 'narsese-belief');
        this.episodicMemory?.log('response', text, {kind: 'narsese-belief'}).catch(() => {});
        return text;
    }

    private handleQuestion(input: string, r: Extract<Route, {kind: 'narsese-question'}>): string {
        const needle = r.narsese ?? '';
        const ans = this.nar?.getBeliefs().find(b => {
            const t = (b as {term?: {toString(): string}}).term;
            return t && t.toString().includes(needle);
        });
        const truth = (ans as {truth?: {f: number; c: number}} | undefined)?.truth;
        const term = (ans as {term?: {toString(): string}} | undefined)?.term;
        const text = ans && term
            ? `<${term.toString()}>${truth ? ` f=${truth.f.toFixed(2)} c=${truth.c.toFixed(2)}` : ''}`
            : `No answer for: ${needle || input}`;
        this.logEpisode(input, text, [], 'narsese-question');
        this.episodicMemory?.log('response', text, {kind: 'narsese-question'}).catch(() => {});
        return text;
    }

    private handleCommand(input: string, r: Extract<Route, {kind: 'command'}>): string {
        const text = `[${r.command}${r.arguments?.length ? ' ' + r.arguments.join(' ') : ''}]`;
        this.logEpisode(input, text, [], 'command');
        this.episodicMemory?.log('response', text, {kind: 'command'}).catch(() => {});
        return text;
    }

    private async handleNL(input: string): Promise<string> {
        const tools = this.buildTools();
        const snapshot = this.buildSnapshot();
        const system = snapshot ? `${this.systemInstructions}\n\n## Cognitive State\n${snapshot}` : this.systemInstructions;

        const result = await this.collectRun({system, input, tools});

        for (const call of result.toolCalls) recordTool(call.toolName);

        this.history.push({role: 'user', content: input, timestamp: Date.now()});
        this.history.push({role: 'assistant', content: result.text, timestamp: Date.now()});
        if (this.history.length > MAX_HISTORY) this.history = this.history.slice(-MAX_HISTORY);

        for (const a of result.artifacts) {
            if (a.type === 'belief_added' && a.content) {
                this.pinned.push(a.content);
                if (this.pinned.length > MAX_PINNED) this.pinned = this.pinned.slice(-MAX_PINNED);
            }
        }

        const concepts = result.artifacts.map(a => a.content).filter((c): c is string => typeof c === 'string');
        this.logEpisode(input, result.text, concepts, 'nl');
        this.episodicMemory?.log('response', result.text, {kind: 'nl', toolCalls: result.toolCalls.length}).catch(() => {});
        return result.text;
    }

    private buildTools(): Record<string, unknown> {
        const tools: Record<string, unknown> = {};
        if (this.nar) Object.assign(tools, createNARSTools(this.nar as Parameters<typeof createNARSTools>[0]));
        Object.assign(tools, createGeneralTools({
            nar: this.nar as Parameters<typeof createGeneralTools>[0]['nar'],
            episodicMemory: this.episodicMemory as Parameters<typeof createGeneralTools>[0]['episodicMemory'],
        }));
        return tools;
    }

    private buildSnapshot(): string {
        if (!this.nar) return '';
        const attn = this.nar.attentionReport();
        const parts: string[] = [];
        if (this.pinned.length) {
            parts.push('Pinned beliefs:');
            for (const b of this.pinned) parts.push(`  - ${b}`);
        }
        if (attn.concepts.length) {
            parts.push('Attention focus:');
            for (const c of attn.concepts.slice(0, MAX_CONCEPT_SLICE)) {
                parts.push(`  - ${c.term} (p=${c.priority.toFixed(2)})`);
            }
        }
        const questions = this.nar.getQuestions().slice(0, MAX_QUESTION_SLICE);
        if (questions.length) {
            parts.push('Open questions:');
            for (const q of questions) {
                const term = (q as {term?: {toString(): string}}).term;
                if (term) parts.push(`  ? ${term.toString()}`);
            }
        }
        return parts.join('\n');
    }

    private async collectRun(args: {system: string; input: string; tools: Record<string, unknown>}) {
        const messages = [
            ...this.history.slice(-20).map(h => ({role: h.role, content: h.content})),
            {role: 'user' as const, content: args.input},
        ];
        const composed = {
            system: args.system,
            messages,
            tools: args.tools,
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };
        const iter = this.runner.run(composed as never);
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return next.value;
    }

    private recordToolsFor(name: string): void { recordTool(name); }

    private logEpisode(input: string, response: string, concepts: string[], routeKind: string): void {
        this.episodeLog.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            input, response, concepts, routeKind, timestamp: Date.now(),
        });
        if (this.episodeLog.length > MAX_EPISODES) this.episodeLog = this.episodeLog.slice(-MAX_EPISODES);
    }

    getPolicy() { return getPolicy(); }

    getRecentEpisodes(limit = 20): EpisodeRecord[] { return this.episodeLog.slice(-limit); }

    getHistory(limit = 20): ConversationEntry[] { return this.history.slice(-limit); }

    getPinned(): string[] { return [...this.pinned]; }

    async summarize(lm: {generateText(prompt: string): Promise<string>}): Promise<void> {
        if (this.history.length <= 30) return;
        const toSummarize = this.history.slice(0, -10);
        const prompt = `Summarize: ${toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')}`;
        const summary = await lm.generateText(prompt);
        this.history = this.history.slice(-10);
        this.history.unshift({role: 'assistant', content: `Summary: ${summary}`, timestamp: Date.now()});
    }

    listEpisodes(limit = 20): Array<{id: string; input: string; routeKind?: string}> {
        return this.episodeLog.slice(-limit).map(r => ({id: r.id, input: r.input, routeKind: r.routeKind}));
    }

    replay(_id: string): Promise<never> {
        return Promise.reject(new Error('replay is not supported in the slim v4 agent'));
    }
}
