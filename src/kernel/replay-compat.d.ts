/**
 * File-based replay compatibility — provides the legacy replay functions
 * that read from JSONL files (gate-events.jsonl, derivations.jsonl).
 *
 * These functions are kept for backward compatibility with the replay CLI
 * and tests. New code should use LogStore-based replay from @senars/log/replay.
 */
import type { CognitiveEvent } from '@senars/schemas/cognitive-events';
import { type DerivationRecord } from '@senars/schemas/derivation-records';
import type { IdSource } from '@senars/util/id';
import type { RandomSource } from '@senars/util/random';
import type { Clock } from './env';
import { createDefaultRegistry } from '../cognitive/impls/CognitiveRegistry';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import { Memory } from '../memory/memory';
import type { MemoryPorts } from '../memory/ports/index';
import { serialize as serializeMemory } from '../memory/state/serialization';
import type { ProposalReplayState } from '../proposal/replay';
import { type CognitiveStateSnapshot } from '../log/replay-reducers';
export interface FullReplayOptions {
    gateEventsPath: string;
    derivationRecordsPath?: string;
    memoryConfig?: ConstructorParameters<typeof Memory>[0];
    cognitiveParams?: CognitiveParameters;
    strategyRegistry?: ReturnType<typeof createDefaultRegistry>;
    range?: {
        from?: number;
        to?: number;
    };
    idRange?: {
        from?: string;
        to?: string;
    };
    ids?: IdSource;
    rng?: RandomSource;
    clock?: Clock;
}
export interface ReplayTally {
    appliedTasks: number;
    appliedRevisions: number;
    appliedDerivations: number;
    appliedActivations: number;
    appliedProposals: number;
    skipped: number;
    errors: string[];
}
export interface ReplayResult extends ReplayTally {
    memory: MemoryPorts;
    gateSnapshot: CognitiveStateSnapshot;
    proposalState?: ProposalReplayState;
}
export declare function replayIntoMemory(options: FullReplayOptions): Promise<ReplayResult>;
export declare function computeReplayStateHash(result: ReplayResult, serializedMemory?: ReturnType<typeof serializeMemory>): string;
export declare function verifyReplayStateHash(result: ReplayResult, expectedHash: string): {
    valid: boolean;
    actual: string;
};
export interface ReplaySnapshotFile {
    version: number;
    timestamp: number;
    stateHash: string;
    gateSnapshot: ReplayResult['gateSnapshot'];
    proposalState?: ProposalReplayState;
    memory: unknown;
    stats: ReplayTally;
}
export declare function serializeReplayResult(result: ReplayResult, outputPath: string, clock?: Clock): Promise<void>;
export declare function persistDerivationRecords(records: DerivationRecord[], path: string): {
    appended: number;
};
export declare function loadGateEvents(path: string): {
    events: CognitiveEvent[];
    invalid: number;
};
export { replayTaskAdmissions, replayCognitiveState, type CognitiveStateSnapshot } from '../log/replay-reducers';
//# sourceMappingURL=replay-compat.d.ts.map