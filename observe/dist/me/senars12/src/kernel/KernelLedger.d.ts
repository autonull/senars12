/**
 * The kernel's runtime durability pair (CORE.19 C3.3/C4.3): gate decisions and
 * rule fires, written beside each other under one state path.
 *
 * It exists so the NAR facade wires one ledger instead of two — and so `nar.ts`
 * stays under its monolith budget. Each half owns its own file family and its
 * own replay; this only composes them.
 *
 * LogStore-backed ledgers are used for unified persistence.
 */
import type { DerivationRecorder } from '../rules/impls/recorder';
import type { GateRegistry } from './GateRegistry';
import type { LogStore } from '@senars/log/store';
import { createLogStoreGateEventLedger } from '@senars/log/GateEventLedger';
import { createLogStoreDerivationLedger } from '@senars/log/DerivationLedger';
export interface KernelLedgerOptions {
    /** LogStore for unified persistence (replaces file-based ledgers). */
    logStore: LogStore;
}
type GateLedger = ReturnType<typeof createLogStoreGateEventLedger>;
type DerivationLedgerLike = ReturnType<typeof createLogStoreDerivationLedger>;
export declare class KernelLedger {
    #private;
    readonly gates: GateLedger;
    readonly derivations: DerivationLedgerLike;
    constructor(_basePath: string, recorder: DerivationRecorder, options: KernelLedgerOptions);
    /** Append every not-yet-written gate event, rule fire, and completed chain; returns the count. */
    flush(gates: GateRegistry, recorder: DerivationRecorder): Promise<number>;
    /** Re-seed the gate rings, the fire ring, and the completed chains from disk. */
    replay(gates: GateRegistry, recorder: DerivationRecorder): Promise<number>;
    close(): void;
}
export {};
//# sourceMappingURL=KernelLedger.d.ts.map