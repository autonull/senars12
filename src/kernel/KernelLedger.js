import { createLogStoreGateEventLedger } from '@senars/log/GateEventLedger';
import { createLogStoreDerivationLedger } from '@senars/log/DerivationLedger';
export class KernelLedger {
    gates;
    derivations;
    #logStore;
    constructor(_basePath, recorder, options) {
        this.#logStore = options.logStore;
        // Use LogStore-backed ledgers (unified persistence)
        this.gates = createLogStoreGateEventLedger(this.#logStore);
        this.derivations = createLogStoreDerivationLedger(this.#logStore);
        this.derivations.observe(recorder);
    }
    /** Append every not-yet-written gate event, rule fire, and completed chain; returns the count. */
    async flush(gates, recorder) {
        return ((await this.gates.flush(gates)) +
            (await this.derivations.flush(recorder)) +
            (await this.derivations.flushRecords(recorder)));
    }
    /** Re-seed the gate rings, the fire ring, and the completed chains from disk. */
    async replay(gates, recorder) {
        return ((await this.gates.replayInto(gates)) +
            (await this.derivations.replayInto(recorder)) +
            (await this.derivations.replayRecordsInto(recorder)));
    }
    close() {
        this.gates.close();
        this.derivations.close();
        this.#logStore.close();
    }
}
