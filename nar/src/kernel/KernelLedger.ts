/**
 * The kernel's runtime durability pair (CORE.19 C3.3/C4.3): gate decisions and
 * rule fires, written beside each other under one state path.
 *
 * It exists so the NAR facade wires one ledger instead of two — and so `nar.ts`
 * stays under its monolith budget. Each half owns its own file family and its
 * own replay; this only composes them.
 */
import { join } from 'node:path';
import type { DerivationRecorder } from '../rules/impls/recorder.js';
import { DerivationLedger } from './DerivationLedger.js';
import { GateEventLedger } from './GateEventLedger.js';
import type { GateRegistry } from './GateRegistry.js';

export class KernelLedger {
  readonly gates: GateEventLedger;
  readonly derivations: DerivationLedger;

  constructor(basePath: string) {
    this.gates = new GateEventLedger(join(basePath, 'gate-events'));
    this.derivations = new DerivationLedger(join(basePath, 'derivations'));
  }

  /** Append every not-yet-written gate event and rule fire; returns the count. */
  flush(gates: GateRegistry, recorder: DerivationRecorder): number {
    return this.gates.flush(gates) + this.derivations.flush(recorder);
  }

  /** Re-seed the gate rings and the fire ring from disk; returns how many were restored. */
  async replay(gates: GateRegistry, recorder: DerivationRecorder): Promise<number> {
    return (await this.gates.replayInto(gates)) + (await this.derivations.replayInto(recorder));
  }

  close(): void {
    this.gates.close();
    this.derivations.close();
  }
}
