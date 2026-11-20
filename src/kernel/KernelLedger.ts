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
import type { DerivationRecorder } from '../rules/impls/recorder.js';
import type { GateRegistry } from './GateRegistry.js';
import type { LogStore } from '@senars/log/store';
import { createLogStoreGateEventLedger } from '@senars/log/GateEventLedger.js';
import { createLogStoreDerivationLedger } from '@senars/log/DerivationLedger.js';

export interface KernelLedgerOptions {
  /** LogStore for unified persistence (replaces file-based ledgers). */
  logStore: LogStore;
}

type GateLedger = ReturnType<typeof createLogStoreGateEventLedger>;
type DerivationLedgerLike = ReturnType<typeof createLogStoreDerivationLedger>;

export class KernelLedger {
  readonly gates: GateLedger;
  readonly derivations: DerivationLedgerLike;
  readonly #logStore: LogStore;

  constructor(
    _basePath: string,
    recorder: DerivationRecorder,
    options: KernelLedgerOptions
  ) {
    this.#logStore = options.logStore;

    // Use LogStore-backed ledgers (unified persistence)
    this.gates = createLogStoreGateEventLedger(this.#logStore);
    this.derivations = createLogStoreDerivationLedger(this.#logStore);
    this.derivations.observe(recorder);
  }

  /** Append every not-yet-written gate event, rule fire, and completed chain; returns the count. */
  async flush(gates: GateRegistry, recorder: DerivationRecorder): Promise<number> {
    return (
      (await this.gates.flush(gates)) +
      (await this.derivations.flush(recorder)) +
      (await this.derivations.flushRecords(recorder))
    );
  }

  /** Re-seed the gate rings, the fire ring, and the completed chains from disk. */
  async replay(gates: GateRegistry, recorder: DerivationRecorder): Promise<number> {
    return (
      (await this.gates.replayInto(gates)) +
      (await this.derivations.replayInto(recorder)) +
      (await this.derivations.replayRecordsInto(recorder))
    );
  }

  close(): void {
    this.gates.close();
    this.derivations.close();
    this.#logStore.close();
  }
}