/**
 * Faculty Specifications — the 20 core faculty definitions.
 *
 * Each faculty is a named capability with a specific input/output contract.
 * Faculties are invoked through the oracle seam for deterministic replay.
 * Spec data is in ./data.ts to keep this file focused on types and logic.
 */
import type { Term } from '../kernel/terms';
import type { Task } from '../kernel/types';
import type { Truth } from '@senars/terms';
import type { OracleOperation } from '../oracles/oracle';
import { NameRegistry } from '../util/registry';
/** Faculty categories. */
export declare const FACULTY_CATEGORIES: readonly ['perception', 'reasoning', 'memory', 'action', 'learning', 'communication', 'planning', 'evaluation', 'meta', 'governance'];
export type FacultyCategory = (typeof FACULTY_CATEGORIES)[number];
/** The 20 core faculties (10 original + perceive.formalize + 9 LM roles). */
export declare const FACULTIES: readonly ['grounding', 'inference', 'abduction', 'induction', 'analogy', 'revision', 'planning', 'evaluation', 'communication', 'governance', 'perceive.formalize', 'propose.action', 'propose.hypothesis', 'propose.repair', 'propose.plan', 'propose.skill', 'retrieve.rerank', 'judge.rubric', 'narrate.explain', 'mirror.postmortem', 'simulate.scenario'];
export type FacultyName = (typeof FACULTIES)[number];
/** Faculty input. */
export interface FacultyInput {
    /** The faculty being invoked. */
    faculty: FacultyName;
    /** Primary term/task. */
    primary: Term | Task;
    /** Secondary term/task (optional). */
    secondary?: Term | Task;
    /** Context for the faculty. */
    context?: FacultyContext;
    /** Budget for this invocation. */
    budget?: number;
    /** Priority. */
    priority?: number;
}
/** Faculty context. */
export interface FacultyContext {
    /** Current truth value. */
    truth?: Truth;
    /** Confidence threshold. */
    confidenceThreshold?: number;
    /** Maximum results. */
    maxResults?: number;
    /** Whether to use fallback. */
    useFallback?: boolean;
    /** Additional metadata. */
    metadata?: Record<string, unknown>;
    /** Mode for perceive.formalize faculty. */
    mode?: 'nl-to-formal' | 'formal-to-nl';
}
/** Faculty output. */
export interface FacultyOutput<T = unknown> {
    /** The faculty that produced this output. */
    faculty: FacultyName;
    /** The result value. */
    result: T;
    /** Confidence in the result. */
    confidence: number;
    /** Evidence supporting the result. */
    evidence?: FacultyEvidence[];
    /** Fallback used (if any). */
    fallbackUsed?: boolean;
    /** Duration in ms. */
    durationMs: number;
    /** Oracle call metadata. */
    oracleMeta?: FacultyOracleMeta;
}
/** Faculty evidence. */
export interface FacultyEvidence {
    /** Source of evidence. */
    source: 'oracle' | 'memory' | 'rule' | 'observation' | 'axiom' | 'fallback';
    /** Description. */
    description: string;
    /** Strength of evidence. */
    strength: number;
    /** Oracle call ID if from oracle. */
    oracleCallId?: string;
}
/** Faculty oracle metadata. */
export interface FacultyOracleMeta {
    /** Oracle operation used. */
    operation: OracleOperation;
    /** Oracle call ID. */
    callId: string;
    /** Oracle provider. */
    provider: string;
    /** Whether result was pinned. */
    pinned: boolean;
    /** Duration in milliseconds. */
    durationMs: number;
}
/** Faculty specification. */
export interface FacultySpec {
    /** Faculty name. */
    name: FacultyName;
    /** Human-readable description. */
    description: string;
    /** Category. */
    category: FacultyCategory;
    /** Input schema (Zod schema or JSON schema). */
    inputSchema: unknown;
    /** Output schema (Zod schema or JSON schema). */
    outputSchema: unknown;
    /** Oracle operation this faculty uses. */
    oracleOperation: OracleOperation;
    /** Pure-NAL symbolic fallback. */
    fallback: FacultyFallback;
    /** Whether this faculty is enabled. */
    enabled: boolean;
    /** Priority for selection. */
    priority: number;
    /** Budget cost. */
    budgetCost: number;
    /** Maximum concurrent invocations. */
    maxConcurrency: number;
    /** Timeout in ms. */
    timeoutMs: number;
    /** Retry configuration. */
    retry?: {
        attempts: number;
        backoffMs: number;
    };
}
/** Faculty fallback function type. */
export type FacultyFallback = (input: FacultyInput) => Promise<FacultyOutput | null>;
/** Faculty registry. */
export declare class FacultyRegistry extends NameRegistry<FacultySpec> {
    private fallbacks;
    constructor();
    /** Register a faculty specification. */
    register(spec: FacultySpec): void;
    /** Get faculties by category. */
    getByCategory(category: FacultyCategory): FacultySpec[];
    /** Get enabled faculties. */
    getEnabled(): FacultySpec[];
    /** Get fallback for a faculty. */
    getFallback(name: FacultyName): FacultyFallback | undefined;
}
/** Create an isolated faculty registry. */
export declare function createFacultyRegistry(): FacultyRegistry;
/** Global faculty registry (convenience; prefer {@link createFacultyRegistry}). */
export declare const facultyRegistry: FacultyRegistry;
/** Register a faculty globally. */
export declare function registerFaculty(spec: FacultySpec): void;
/** The 20 core faculty specifications, in registration order. */
export { CORE_FACULTIES } from './specs/data';
/** Register all core faculties, into `registry` (global by default). */
export declare function registerCoreFaculties(registry?: FacultyRegistry): void;
//# sourceMappingURL=specs.d.ts.map