/**
 * Loop Record — structured recording of loop iterations for replay and analysis.
 */
import type { Task } from '../kernel/types';
import type { SelectionResult } from './select';
import type { ActionResult } from './act';
import type { JudgmentResult } from '../faculties/judgment/cascade';
import type { Clock, IDGenerator } from '../kernel/env';
/** Record types. */
export declare const RECORD_TYPES: readonly ['iteration', 'selection', 'action', 'judgment', 'oracle', 'contract', 'repair', 'appraisal'];
export type RecordType = (typeof RECORD_TYPES)[number];
/** Base record. */
export interface BaseRecord {
    /** Record type. */
    type: RecordType;
    /** Unique record ID. */
    id: string;
    /** Iteration number. */
    iteration: number;
    /** Timestamp (ms). */
    timestamp: number;
    /** Correlation ID for tracing. */
    correlationId: string;
}
/** Iteration record. */
export interface IterationRecord extends BaseRecord {
    type: 'iteration';
    payload: {
        /** Task processed this iteration. */
        task: Task;
        /** Selected action. */
        action: Task;
        /** Outcome. */
        outcome: 'success' | 'failure' | 'partial';
        /** Duration (ms). */
        durationMs: number;
        /** Resources used. */
        resources: {
            tokensUsed: number;
            oracleCalls: number;
            facultyCalls: number;
        };
        /** Contract results. */
        contracts: ContractRecord[];
    };
}
/** Selection record. */
export interface SelectionRecord extends BaseRecord {
    type: 'selection';
    payload: SelectionResult & {
        contextSnapshot: {
            numCandidates: number;
            numBeliefs: number;
            numGoals: number;
            budget: number;
        };
    };
}
/** Action record. */
export interface ActionRecord extends BaseRecord {
    type: 'action';
    payload: ActionResult & {
        actionType: string;
        preconditionsChecked: number;
        preconditionsPassed: number;
    };
}
/** Judgment record. */
export interface JudgmentRecord extends BaseRecord {
    type: 'judgment';
    payload: JudgmentResult & {
        situation: string;
        numCandidates: number;
    };
}
/** Oracle call record. */
export interface OracleRecord extends BaseRecord {
    type: 'oracle';
    payload: {
        operation: string;
        provider: string;
        args: unknown[];
        result: any;
        durationMs: number;
        success: boolean;
        pinned: boolean;
        tokens?: number;
    };
}
/** Contract check record. */
export interface ContractRecord extends BaseRecord {
    type: 'contract';
    payload: {
        contractId: string;
        contractType: string;
        passed: boolean;
        severity: string;
        message: string;
    };
}
/** Repair record. */
export interface RepairRecord extends BaseRecord {
    type: 'repair';
    payload: {
        anomalyId: string;
        anomalyType: string;
        actions: Array<{
            type: string;
            target: string;
            success: boolean;
        }>;
        success: boolean;
        durationMs: number;
    };
}
/** Appraisal record. */
export interface AppraisalRecord extends BaseRecord {
    type: 'appraisal';
    payload: {
        overallScore: number;
        dimensions: Record<string, number>;
        recommendations: string[];
    };
}
/** Union of all record types. */
export type LoopRecord = IterationRecord | SelectionRecord | ActionRecord | JudgmentRecord | OracleRecord | ContractRecord | RepairRecord | AppraisalRecord;
/** Record store configuration. */
export interface RecordStoreConfig {
    /** Directory for record files. */
    dir: string;
    /** Max records per file. */
    maxRecordsPerFile: number;
    /** Compress records. */
    compress: boolean;
    /** Retention period (ms). */
    retentionMs: number;
}
/** Default record store config. */
export declare const defaultRecordStoreConfig: RecordStoreConfig;
/** Loop record store. */
export declare class LoopRecordStore {
    private config;
    private currentFile;
    private currentCount;
    private currentFd;
    private index;
    private initialized;
    constructor(config?: Partial<RecordStoreConfig>);
    /** Initialize the store. */
    open(): Promise<void>;
    /** Load existing index. */
    private loadIndex;
    /** Open current write file. */
    private openCurrentFile;
    /** Write a record. */
    write(record: LoopRecord): Promise<void>;
    /** Write multiple records. */
    writeBatch(records: LoopRecord[]): Promise<void>;
    /** Read a record by ID. */
    read(id: string): Promise<LoopRecord | null>;
    /** Query records by iteration range. */
    queryByIteration(start: number, end: number): Promise<LoopRecord[]>;
    /** Query records by type. */
    queryByType(type: RecordType, limit?: number): Promise<LoopRecord[]>;
    /** Query records by correlation ID. */
    queryByCorrelation(correlationId: string): Promise<LoopRecord[]>;
    /** Close the store. */
    close(): Promise<void>;
    /** Get statistics. */
    getStats(): {
        totalRecords: number;
        files: number;
        iterations: number;
        byType: Record<RecordType, number>;
    };
}
/** Create a loop record store. */
export declare function createLoopRecordStore(config?: Partial<RecordStoreConfig>): LoopRecordStore;
/** Loop recorder — high-level interface for recording loop events. */
export declare class LoopRecorder {
    private store;
    private correlationId;
    private iteration;
    private enabled;
    private readonly clock;
    private readonly ids;
    constructor(store: LoopRecordStore, correlationId?: string, options?: {
        clock?: Clock;
        ids?: IDGenerator;
    });
    /** Set enabled state. */
    setEnabled(enabled: boolean): void;
    /** Start new iteration. */
    startIteration(): number;
    /** Get current iteration. */
    getIteration(): number;
    /** Record iteration. */
    recordIteration(payload: IterationRecord['payload']): Promise<void>;
    /** Record selection. */
    recordSelection(payload: SelectionRecord['payload']): Promise<void>;
    /** Record action. */
    recordAction(payload: ActionRecord['payload']): Promise<void>;
    /** Record judgment. */
    recordJudgment(payload: JudgmentRecord['payload']): Promise<void>;
    /** Record oracle call. */
    recordOracle(payload: OracleRecord['payload']): Promise<void>;
    /** Record contract check. */
    recordContract(payload: ContractRecord['payload']): Promise<void>;
    /** Record repair. */
    recordRepair(payload: RepairRecord['payload']): Promise<void>;
    /** Record appraisal. */
    recordAppraisal(payload: AppraisalRecord['payload']): Promise<void>;
    /** Get correlation ID. */
    getCorrelationId(): string;
    /** Close the underlying store. */
    close(): Promise<void>;
}
/** Create a loop recorder. */
export declare function createLoopRecorder(store?: LoopRecordStore, correlationId?: string, options?: {
    clock?: Clock;
    ids?: IDGenerator;
}): LoopRecorder;
//# sourceMappingURL=record.d.ts.map