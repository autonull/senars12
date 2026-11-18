/**
 * The kernel's runtime durability pair (CORE.19 C3.3/C4.3): gate decisions and
 * rule fires, written beside each other under one state path.
 *
 * It exists so the NAR facade wires one ledger instead of two — and so `nar.ts`
 * stays under its monolith budget. Each half owns its own file family and its
 * own replay; this only composes them.
 *
 * When a LogStore is provided, LogStore-backed ledgers are used (unified persistence).
 * Otherwise, legacy file-based ledgers are used for backward compatibility.
 */
import { join } from 'node:path';
import type { DerivationRecorder } from '../rules/impls/recorder.js';
import { DerivationLedger } from './DerivationLedger.js';
import { GateEventLedger } from './GateEventLedger.js';
import type { GateRegistry } from './GateRegistry.js';
import type { LogStore } from '@senars/log/store';
import { createLogStoreGateEventLedger } from '@senars/log/GateEventLedger.js';
import { createLogStoreDerivationLedger } from '@senars/log/DerivationLedger.js';

export interface KernelLedgerOptions {
  /** Optional LogStore for unified persistence (replaces file-based ledgers). */
  logStore?: LogStore;
  /** Base path for legacy file-based ledgers (used when logStore not provided). */
  basePath?: string;
}

type GateLedger = GateEventLedger | ReturnType<typeof createLogStoreGateEventLedger>;
type DerivationLedgerLike = DerivationLedger | ReturnType<typeof createLogStoreDerivationLedger>;

export class KernelLedger {
  readonly gates: GateLedger;
  readonly derivations: DerivationLedgerLike;
  readonly #logStore?: LogStore;
  readonly #basePath?: string;

  constructor(
    basePath: string,
    recorder: DerivationRecorder,
    options: KernelLedgerOptions = {}
  ) {
    this.#logStore = options.logStore;
    this.#basePath = basePath;

    if (this.#logStore) {
      // Use LogStore-backed ledgers (unified persistence)
      this.gates = createLogStoreGateEventLedger(this.#logStore);
      this.derivations = createLogStoreDerivationLedger(this.#logStore);
      this.derivations.observe(recorder);
    } else {
      // Legacy file-based ledgers
      const actualBasePath = this.#basePath ?? basePath;
      this.gates = new GateEventLedger(join(actualBasePath, 'gate-events'));
      this.derivations = new DerivationLedger(join(actualBasePath, 'derivations'));
      this.derivations.observe(recorder);
    }
  }

  /** Append every not-yet-written gate event and rule fire; returns the count. */
  async flush(gates: GateRegistry, recorder: DerivationRecorder): Promise<number> {
    return (await this.gates.flush(gates)) + (await this.derivations.flush(recorder));
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
  }
}