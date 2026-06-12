import {createAgent, type Agent, type AgentOptions} from '../../src/agent/agent.js';
import {createSession, type ConversationSession} from '../../src/agent/ConversationSession.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import type {NAR} from '../../src/nar/nar.js';
import type {LMClient} from '../../src/nar/lm/types.js';

export interface ProbeExpectations {
    responseContains?: string[];
    responseContainsAny?: string[];
    responseNotContains?: string[];
    responseMatches?: string[];
    minBeliefs?: number;
    expectToolCall?: string;
    expectNarseseParsed?: boolean;
    expectBeliefIncrease?: boolean;
    maxDurationMs?: number;
}

export interface ProbeResult {
    input: string;
    response: string;
    narseseParsed: boolean;
    nlTranslated: boolean;
    toolCalls: Array<{name: string; args: unknown}>;
    beliefsBefore: number;
    beliefsAfter: number;
    derivations: number;
    durationMs: number;
    lmCalls: number;
    errors: string[];
}

export interface Probe {
    input: string;
    expect?: ProbeExpectations;
}

export interface Scenario {
    name: string;
    description: string;
    seedBeliefs?: string[];
    probes: Probe[];
}

export interface ScenarioResult {
    name: string;
    probes: ProbeResult[];
    passed: number;
    failed: number;
    durationMs: number;
}

export interface HarnessOptions {
    lmClient?: LMClient;
    agentOptions?: Partial<AgentOptions>;
    verbose?: boolean;
    timeoutMs?: number;
}

function createSilentLogger() {
    return {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        child: () => createSilentLogger(),
    };
}

export class ConversationalTestHarness {
    private agent: Agent | undefined;
    private nar: NAR | undefined;
    private session: ConversationSession;
    private lmClient: LMClient | undefined;
    private agentOptions: Partial<AgentOptions>;
    private verbose: boolean;
    private timeoutMs: number;
    private lmCallCount = 0;

    constructor(opts: HarnessOptions = {}) {
        this.lmClient = opts.lmClient;
        this.agentOptions = opts.agentOptions ?? {};
        this.verbose = opts.verbose ?? false;
        this.timeoutMs = opts.timeoutMs ?? 30_000;
        this.session = createSession('test:harness');
    }

    async setup(): Promise<void> {
        this.nar = SeNARSFactory.createForTesting();
        await this.nar.initialize();
        await this.nar.start();

        const trackingLM: LMClient | undefined = this.lmClient
            ? {
                ...this.lmClient,
                generateText: async (prompt: string, opts?: Parameters<LMClient['generateText']>[1]) => {
                    this.lmCallCount++;
                    return this.lmClient!.generateText(prompt, opts);
                },
            }
            : undefined;

        this.agent = createAgent({
            nar: this.nar,
            lmClient: trackingLM,
            logger: createSilentLogger() as never,
            ...this.agentOptions,
        });
        this.agent.start();
    }

    async teardown(): Promise<void> {
        this.agent?.stop();
        if (this.nar && (this.nar.state === 'started' || this.nar.state === 'initialized')) {
            await this.nar.stop();
        }
    }

    getAgent(): Agent | undefined {
        return this.agent;
    }

    getNAR(): NAR | undefined {
        return this.nar;
    }

    private getBeliefCount(): number {
        return this.nar?.getBeliefs().length ?? 0;
    }

    private getDerivationCount(): number {
        return this.agent?.getRecentDerivations().length ?? 0;
    }

    async probe(input: string, expectations?: ProbeExpectations): Promise<ProbeResult> {
        if (!this.agent) throw new Error('Harness not set up — call setup() first');

        const beliefsBefore = this.getBeliefCount();
        const derivationsBefore = this.getDerivationCount();
        const lmBefore = this.lmCallCount;
        const errors: string[] = [];
        const startTime = Date.now();
        const toolCalls: Array<{name: string; args: unknown}> = [];

        const effectiveTimeout = expectations?.maxDurationMs ?? this.timeoutMs;
        const timeoutController = new AbortController();
        const timeoutHandle = setTimeout(() => timeoutController.abort(), effectiveTimeout);

        let response = '';
        try {
            const stream = this.agent.chatStream(input, this.session, {signal: timeoutController.signal});
            let next = await stream.next();
            while (!next.done) {
                const ev = next.value;
                if (ev.kind === 'tool-call' && ev.toolName) {
                    toolCalls.push({name: ev.toolName, args: ev.toolArgs});
                }
                if (ev.kind === 'error') {
                    errors.push(ev.error ?? 'unknown stream error');
                }
                next = await stream.next();
            }
            response = next.value ?? '';
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
        } finally {
            clearTimeout(timeoutHandle);
        }

        const durationMs = Date.now() - startTime;
        const beliefsAfter = this.getBeliefCount();
        const derivations = this.getDerivationCount() - derivationsBefore;

        const narseseParsed = response.startsWith('+ ') || response.startsWith('Question queued:');
        const nlTranslated = response.includes('Recorded') || response.includes('belief') || response.includes('question');

        const result: ProbeResult = {
            input,
            response,
            narseseParsed,
            nlTranslated,
            toolCalls,
            beliefsBefore,
            beliefsAfter,
            derivations,
            durationMs,
            lmCalls: this.lmCallCount - lmBefore,
            errors,
        };

        if (this.verbose) {
            this.logProbe(result);
        }

        return result;
    }

    async runScenario(scenario: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        const probeResults: ProbeResult[] = [];
        let passed = 0;
        let failed = 0;

        if (scenario.seedBeliefs) {
            for (const belief of scenario.seedBeliefs) {
                await this.agent?.believe(belief);
            }
        }

        for (const probe of scenario.probes) {
            const result = await this.probe(probe.input, probe.expect);
            probeResults.push(result);

            if (this.evaluateProbe(result, probe.expect)) {
                passed++;
            } else {
                failed++;
            }
        }

        return {
            name: scenario.name,
            probes: probeResults,
            passed,
            failed,
            durationMs: Date.now() - startTime,
        };
    }

    private evaluateProbe(result: ProbeResult, expect?: ProbeExpectations): boolean {
        if (!expect) return result.errors.length === 0;
        const {response} = result;
        const lower = response.toLowerCase();

        if (expect.responseContains) {
            for (const phrase of expect.responseContains) {
                if (!lower.includes(phrase.toLowerCase())) return false;
            }
        }
        if (expect.responseContainsAny) {
            if (!expect.responseContainsAny.some(phrase => lower.includes(phrase.toLowerCase()))) return false;
        }
        if (expect.responseNotContains) {
            for (const phrase of expect.responseNotContains) {
                if (lower.includes(phrase.toLowerCase())) return false;
            }
        }
        if (expect.responseMatches) {
            for (const pattern of expect.responseMatches) {
                if (!new RegExp(pattern, 'i').test(response)) return false;
            }
        }
        if (expect.minBeliefs !== undefined) {
            if (result.beliefsAfter < expect.minBeliefs) return false;
        }
        if (expect.expectBeliefIncrease !== undefined) {
            const increased = result.beliefsAfter > result.beliefsBefore;
            if (expect.expectBeliefIncrease !== increased) return false;
        }
        if (expect.expectToolCall !== undefined) {
            if (!result.toolCalls.some(tc => tc.name === expect.expectToolCall)) return false;
        }
        if (expect.expectNarseseParsed !== undefined) {
            if (result.narseseParsed !== expect.expectNarseseParsed) return false;
        }
        if (expect.maxDurationMs !== undefined) {
            if (result.durationMs > expect.maxDurationMs) return false;
        }
        if (result.errors.length > 0) return false;
        return true;
    }

    private logProbe(result: ProbeResult): void {
        const status = result.errors.length > 0 ? 'ERROR' : 'OK';
        console.log(`  [${status}] "${result.input}" → ${result.durationMs}ms`);
        console.log(`    response: ${result.response.slice(0, 120)}${result.response.length > 120 ? '...' : ''}`);
        if (result.beliefsAfter > result.beliefsBefore) {
            console.log(`    beliefs: ${result.beliefsBefore} → ${result.beliefsAfter}`);
        }
        if (result.toolCalls.length > 0) {
            console.log(`    tools: ${result.toolCalls.map(tc => tc.name).join(', ')}`);
        }
    }
}
