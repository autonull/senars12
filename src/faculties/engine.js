/**
 * Faculty Engine — executes faculty invocations through the oracle seam.
 */
import { createHash } from 'crypto';
import { createFacultyRegistry } from './specs';
import { DeterministicClock, DeterministicIDGenerator, DeterministicRNG } from '../kernel/env';
import { createStandardOracleRegistry } from '../oracles/oracle';
import { SenarsError } from '../errors/senars-error';
/** Faculty engine. */
export class FacultyEngine {
    registry;
    oracles;
    clock;
    ids;
    pinStore;
    defaultTimeoutMs;
    enableFallback;
    telemetry;
    isReplay = false;
    stats = {
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        fallbackInvocations: 0,
        pinnedInvocations: 0,
        totalDurationMs: 0,
        byFaculty: {},
    };
    telemetryCallbacks = [];
    constructor(config = {}) {
        this.registry = config.registry ?? createFacultyRegistry();
        this.oracles = config.oracles ?? createStandardOracleRegistry(config.lmService, config.pinStore);
        this.clock = config.clock ?? new DeterministicClock();
        this.ids = config.ids ?? new DeterministicIDGenerator(new DeterministicRNG());
        this.pinStore = config.pinStore ?? null;
        this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
        this.enableFallback = config.enableFallback ?? true;
        this.telemetry = config.telemetry ?? true;
    }
    /** Set the pin store. */
    setPinStore(store) {
        this.pinStore = store;
    }
    /** Enable/disable replay mode. */
    setReplayMode(replay) {
        this.isReplay = replay;
    }
    /** Add a telemetry callback. */
    onTelemetry(callback) {
        this.telemetryCallbacks.push(callback);
    }
    /** Invoke a faculty. */
    async invoke(input) {
        const invocationId = this.ids.uuid();
        const startTs = this.clock.now();
        const facultyName = input.faculty;
        const spec = this.registry.get(facultyName);
        if (!spec) {
            throw new SenarsError(`Faculty ${facultyName} not registered`, 'OPERATION_ERROR');
        }
        if (!spec.enabled) {
            throw new SenarsError(`Faculty ${facultyName} is disabled`, 'OPERATION_ERROR');
        }
        // Get oracle for this faculty to extract provider/version for pinning
        const oracle = this.oracles.get(spec.oracleOperation);
        const provider = oracle?.provider ?? 'unknown';
        const version = oracle?.version;
        const context = {
            invocationId,
            faculty: facultyName,
            input,
            startTs,
        };
        this.stats.totalInvocations++;
        this.initFacultyStats(facultyName);
        const facultyStats = this.stats.byFaculty[facultyName];
        facultyStats.calls++;
        let output;
        let fallbackUsed = false;
        try {
            // Build oracle input first (needed for pinning)
            const oracleInput = this.buildOracleInput(input, spec);
            // Check pin store first if in replay mode
            if (this.isReplay && this.pinStore) {
                const pinned = await this.pinStore.getPin(spec.oracleOperation, oracleInput.args, provider, version, oracleInput.context);
                if (pinned !== null) {
                    this.stats.pinnedInvocations++;
                    this.stats.successfulInvocations++;
                    facultyStats.successes++;
                    output = pinned;
                    output.fallbackUsed = false;
                    this.emitTelemetry(context, output);
                    return output;
                }
            }
            // Invoke through oracle
            output = await this.invokeThroughOracle(input, spec, context, oracleInput);
            this.stats.successfulInvocations++;
            facultyStats.successes++;
            // Pin the result if not in replay mode
            if (!this.isReplay && this.pinStore) {
                const queryDigest = this.pinStore.hashInput(oracleInput.args);
                await this.pinStore.pin(spec.oracleOperation, queryDigest, provider, version, oracleInput.context, output);
            }
        }
        catch (error) {
            this.stats.failedInvocations++;
            facultyStats.calls--; // Don't count failed as call for avg
            if (this.enableFallback && spec.fallback) {
                // Try fallback
                this.stats.fallbackInvocations++;
                facultyStats.fallbacks++;
                try {
                    const fallbackOutput = await spec.fallback(input);
                    if (fallbackOutput) {
                        output = {
                            ...fallbackOutput,
                            fallbackUsed: true,
                            faculty: facultyName,
                        };
                        this.stats.successfulInvocations++; // Fallback success counts as success
                        facultyStats.successes++;
                    }
                    else {
                        throw error;
                    }
                }
                catch (fallbackError) {
                    throw error; // Throw original error
                }
            }
            else {
                throw error;
            }
        }
        finally {
            const durationMs = this.clock.now() - startTs;
            this.stats.totalDurationMs += durationMs;
            this.updateFacultyAvgDuration(facultyName, durationMs);
        }
        output.fallbackUsed = fallbackUsed;
        this.emitTelemetry(context, output);
        return output;
    }
    /** Invoke a faculty through the oracle. */
    async invokeThroughOracle(input, spec, context, oracleInput) {
        const oracle = this.oracles.get(spec.oracleOperation);
        if (!oracle) {
            throw new SenarsError(`No oracle registered for ${spec.oracleOperation}`, 'OPERATION_ERROR');
        }
        const oracleOutput = await oracle.call(oracleInput);
        // Parse oracle output into faculty output
        const facultyOutput = this.parseOracleOutput(oracleOutput, spec, oracleInput.args);
        // Attach oracle metadata
        facultyOutput.oracleMeta = {
            operation: spec.oracleOperation,
            callId: oracleOutput.meta.callId,
            provider: oracleOutput.meta.provider,
            pinned: oracleOutput.meta.pinned,
            durationMs: oracleOutput.meta.durationMs,
        };
        return facultyOutput;
    }
    /** Build oracle input from faculty input. */
    buildOracleInput(input, spec) {
        const { primary, secondary, context } = input;
        switch (spec.oracleOperation) {
            case 'lm.generateText': {
                const prompt = this.buildPrompt(input, spec);
                return {
                    operation: 'lm.generateText',
                    args: [prompt, { task: 'quality', temperature: 0.3 }],
                };
            }
            case 'lm.generateObject': {
                const prompt = this.buildPrompt(input, spec);
                // Schema would be derived from spec.outputSchema
                return {
                    operation: 'lm.generateObject',
                    args: [prompt, {}, { task: 'structured', temperature: 0.3 }],
                };
            }
            case 'retrieval.query': {
                const query = primary.toString();
                return {
                    operation: 'retrieval.query',
                    args: [query, { topK: context?.maxResults ?? 10, threshold: context?.confidenceThreshold ?? 0.7 }],
                };
            }
            case 'engine.z3': {
                const script = this.buildZ3Script(input, spec);
                return {
                    operation: 'engine.z3',
                    args: [script, { timeoutMs: spec.timeoutMs }],
                };
            }
            case 'engine.clingo': {
                const program = this.buildClingoProgram(input, spec);
                return {
                    operation: 'engine.clingo',
                    args: [program, { timeoutMs: spec.timeoutMs, format: 'json' }],
                };
            }
            case 'engine.tau-prolog': {
                const program = this.buildPrologProgram(input, spec);
                const query = this.buildPrologQuery(input, spec);
                return {
                    operation: 'engine.tau-prolog',
                    args: [program, query, { timeoutMs: spec.timeoutMs, maxSolutions: 10 }],
                };
            }
            case 'formalization.nlToFormal': {
                const text = primary.toString();
                const ctx = context;
                return {
                    operation: 'formalization.nlToFormal',
                    args: [text, ctx],
                };
            }
            case 'formalization.formalToNl': {
                const genInput = context?.metadata?.generationInput ?? { term: primary.toString(), direction: 'to-natural' };
                return {
                    operation: 'formalization.formalToNl',
                    args: [genInput],
                };
            }
            default:
                throw new SenarsError(`Unsupported oracle operation: ${spec.oracleOperation}`, 'OPERATION_ERROR');
        }
    }
    /** Build prompt for LM oracles. */
    buildPrompt(input, spec) {
        const { primary, secondary, context } = input;
        const primaryStr = primary.toString();
        const secondaryStr = secondary?.toString() ?? '';
        // Faculty-specific prompt templates
        const templates = {
            grounding: `Find concrete referents for: ${primaryStr}`,
            abduction: `Generate hypotheses explaining: ${primaryStr}`,
            induction: `Induce general pattern from: ${primaryStr} with examples: ${secondaryStr}`,
            analogy: `Find analogies between: ${primaryStr} and ${secondaryStr}`,
            evaluation: `Evaluate outcome: ${primaryStr} against goal: ${secondaryStr}`,
            communication: context?.metadata?.direction === 'to-natural'
                ? `Translate to natural language: ${primaryStr}`
                : `Translate to Narsese: ${primaryStr}`,
            planning: `Decompose goal into plan: ${primaryStr}`,
        };
        return templates[spec.name] ?? `Process: ${primaryStr}`;
    }
    /** Build Z3 script. */
    buildZ3Script(input, spec) {
        // Simplified - would generate proper SMT-LIB based on faculty
        return `(set-logic QF_UF)\n(assert true)\n(check-sat)\n(get-model)`;
    }
    /** Build Clingo program. */
    buildClingoProgram(input, spec) {
        // Simplified - would generate proper ASP based on faculty
        return `plan(1..10).\n:- not goal.`;
    }
    /** Build Prolog program. */
    buildPrologProgram(input, spec) {
        // Simplified - would generate proper Prolog based on faculty
        return `parent(john, mary).\nparent(mary, ann).\nancestor(X, Y) :- parent(X, Y).\nancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).`;
    }
    /** Build Prolog query. */
    buildPrologQuery(input, spec) {
        return `ancestor(john, ann).`;
    }
    /** Parse oracle output into faculty output. */
    parseOracleOutput(oracleOutput, spec, oracleArgs) {
        // This would be faculty-specific parsing
        // For now, return a basic structure
        return {
            faculty: spec.name,
            result: oracleOutput.value,
            confidence: 0.8,
            evidence: [{
                    source: 'oracle',
                    description: `Oracle ${spec.oracleOperation} result`,
                    strength: 0.8,
                    oracleCallId: oracleOutput.meta.callId,
                }],
            fallbackUsed: false,
            durationMs: oracleOutput.meta.durationMs,
        };
    }
    /** Hash faculty input for pinning. */
    hashInput(input) {
        const json = JSON.stringify({
            faculty: input.faculty,
            primary: input.primary?.toString(),
            secondary: input.secondary?.toString(),
            context: input.context,
        }, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        return createHash('sha256').update(json).digest('hex').substring(0, 32);
    }
    /** Initialize faculty stats. */
    initFacultyStats(faculty) {
        if (!this.stats.byFaculty[faculty]) {
            this.stats.byFaculty[faculty] = {
                calls: 0,
                successes: 0,
                fallbacks: 0,
                avgDurationMs: 0,
            };
        }
    }
    /** Update faculty average duration. */
    updateFacultyAvgDuration(faculty, durationMs) {
        const fs = this.stats.byFaculty[faculty];
        if (fs) {
            fs.avgDurationMs = (fs.avgDurationMs * (fs.calls - 1) + durationMs) / fs.calls;
        }
    }
    /** Emit telemetry. */
    emitTelemetry(context, output) {
        if (!this.telemetry)
            return;
        for (const callback of this.telemetryCallbacks) {
            try {
                callback(context, output);
            }
            catch {
                // Ignore telemetry errors
            }
        }
    }
    /** Get engine statistics. */
    getStats() {
        return { ...this.stats };
    }
    /** Get available faculties. */
    getAvailableFaculties() {
        return this.registry.getEnabled();
    }
    /** Check if a faculty is available. */
    hasFaculty(name) {
        return this.registry.has(name);
    }
}
/** Create a faculty engine. */
export function createFacultyEngine(config) {
    return new FacultyEngine(config);
}
/** Global faculty engine instance. */
export const facultyEngine = createFacultyEngine();
/** Convenience function to invoke a faculty. */
export async function invokeFaculty(input) {
    return facultyEngine.invoke(input);
}
