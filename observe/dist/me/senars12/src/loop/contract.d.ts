/**
 * Loop Contracts — preconditions, postconditions, and invariants for the cognitive loop.
 *
 * Provides design-by-contract verification for loop iterations.
 */
import type { Task } from '../kernel/types';
import type { Clock } from '../kernel/env';
import { IdRegistry } from '../util/registry';
/** Contract types. */
export declare const CONTRACT_TYPES: readonly ['precondition', 'postcondition', 'invariant', 'progress', 'safety', 'liveness'];
export type ContractType = (typeof CONTRACT_TYPES)[number];
/** Contract severity. */
export declare const CONTRACT_SEVERITY: readonly ['warning', 'error', 'critical'];
export type ContractSeverity = (typeof CONTRACT_SEVERITY)[number];
/** Contract check result. */
export interface ContractCheckResult {
    /** Contract ID. */
    contractId: string;
    /** Contract type. */
    type: ContractType;
    /** Passed. */
    passed: boolean;
    /** Severity if failed. */
    severity: ContractSeverity;
    /** Message. */
    message: string;
    /** Actual value. */
    actual?: unknown;
    /** Expected value. */
    expected?: unknown;
    /** Timestamp. */
    timestamp: number;
    /** Context. */
    context?: Record<string, unknown>;
}
/** Loop contract. */
export interface LoopContract {
    /** Unique contract ID. */
    id: string;
    /** Human-readable name. */
    name: string;
    /** Contract type. */
    type: ContractType;
    /** Severity if violated. */
    severity: ContractSeverity;
    /** Check function. */
    check: (context: ContractContext) => Promise<ContractCheckResult>;
    /** Description. */
    description: string;
    /** Tags for categorization. */
    tags: string[];
    /** Enabled. */
    enabled: boolean;
}
/** Contract checking context. */
export interface ContractContext {
    /** Current iteration. */
    iteration: number;
    /** Current task being processed. */
    currentTask?: Task;
    /** Focus bag contents. */
    focusBag: Task[];
    /** Current beliefs. */
    beliefs: Task[];
    /** Current goals. */
    goals: Task[];
    /** Selected action. */
    selectedAction?: Task;
    /** Oracle calls made this iteration. */
    oracleCalls: OracleCallRecord[];
    /** Resources. */
    resources: {
        tokensUsed: number;
        tokensRemaining: number;
        wallTimeMs: number;
        cpuTimeMs: number;
    };
    /** Previous iteration results. */
    previousResults?: IterationResult[];
    /** Deterministic clock for timestamps. */
    clock: Clock;
    /** Metadata. */
    metadata?: Record<string, unknown>;
}
/** Oracle call record. */
export interface OracleCallRecord {
    /** Operation. */
    operation: string;
    /** Provider. */
    provider: string;
    /** Success. */
    success: boolean;
    /** Duration (ms). */
    durationMs: number;
    /** Timestamp. */
    timestamp: number;
}
/** Iteration result. */
export interface IterationResult {
    /** Iteration number. */
    iteration: number;
    /** Task processed. */
    task: Task;
    /** Action taken. */
    action: Task;
    /** Outcome. */
    outcome: 'success' | 'failure' | 'partial';
    /** Contracts checked. */
    contractResults: ContractCheckResult[];
    /** Duration (ms). */
    durationMs: number;
}
/** Contract registry using IdRegistry for id-based lookup. */
export declare class ContractRegistry extends IdRegistry<LoopContract> {
    private history;
    private violationCounts;
    /** Register a contract. */
    register(contract: LoopContract): void;
    /** Unregister a contract. */
    unregister(id: string): boolean;
    /** Get a contract. */
    get(id: string): LoopContract | undefined;
    /** Get all contracts. */
    getAll(): LoopContract[];
    /** Get contracts by type. */
    getByType(type: ContractType): LoopContract[];
    /** Get enabled contracts. */
    getEnabled(): LoopContract[];
    /** Check all enabled contracts. */
    checkAll(context: ContractContext): Promise<ContractCheckResult[]>;
    /** Check contracts by type. */
    checkByType(type: ContractType, context: ContractContext): Promise<ContractCheckResult[]>;
    /** Record a check result. */
    private recordResult;
    /** Get contract statistics. */
    getStats(): {
        totalContracts: number;
        enabledContracts: number;
        totalChecks: number;
        violationRate: number;
        byType: Record<ContractType, {
            total: number;
            violations: number;
        }>;
        bySeverity: Record<ContractSeverity, number>;
    };
    /** Get violation history for a contract. */
    getViolations(contractId: string, limit?: number): ContractCheckResult[];
    /** Get recent violations. */
    getRecentViolations(limit?: number): ContractCheckResult[];
    /** Clear history. */
    clearHistory(): void;
}
/** Global contract registry. */
export declare const contractRegistry: ContractRegistry;
/** Register a contract globally. */
export declare function registerContract(contract: LoopContract): void;
/** Check all contracts for a context. */
export declare function checkContracts(context: ContractContext): Promise<ContractCheckResult[]>;
/** Core loop contracts. */
export declare const budgetPositiveContract: LoopContract;
export declare const hasGoalsContract: LoopContract;
export declare const focusBagNotEmptyContract: LoopContract;
export declare const actionValidContract: LoopContract;
export declare const oracleCallsSucceedContract: LoopContract;
export declare const noContradictoryBeliefsContract: LoopContract;
export declare const truthValuesValidContract: LoopContract;
export declare const beliefProgressContract: LoopContract;
export declare const noDangerousActionsContract: LoopContract;
export declare const resourceLimitsContract: LoopContract;
export declare const loopLivenessContract: LoopContract;
/** Register all core contracts. */
export declare function registerCoreContracts(): void;
/** Contract violation handler. */
export type ContractViolationHandler = (result: ContractCheckResult, context: ContractContext) => Promise<void>;
/** Contract monitor — runs checks and handles violations. */
export declare class ContractMonitor {
    private handlers;
    private interval;
    private context;
    /** Add a violation handler. */
    addHandler(handler: ContractViolationHandler): void;
    /** Start monitoring. */
    start(context: ContractContext, intervalMs?: number): void;
    /** Stop monitoring. */
    stop(): void;
    /** Run checks once. */
    checkOnce(context: ContractContext): Promise<ContractCheckResult[]>;
    /** Check contracts and handle violations. */
    private checkAndHandle;
}
/** Create a contract monitor. */
export declare function createContractMonitor(): ContractMonitor;
/** Default violation handler — logs and triggers repair. */
export declare function defaultViolationHandler(result: ContractCheckResult, context: ContractContext): Promise<void>;
//# sourceMappingURL=contract.d.ts.map