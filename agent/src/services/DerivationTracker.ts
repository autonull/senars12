/**
 * Derivation Tracker Service
 * Handles capturing and managing recent derivations
 */

import type {NAR} from '../../../nar/src';
import type {Logger} from '../../../nar/src/logger';
import {createLogger} from '../../../nar/src/logger';
import type {DerivationEntry} from '../agent.js';

const MAX_RECENT_DERIVATIONS = 50;

export interface DerivationTrackerConfig {
    nar?: NAR;
    logger?: Logger;
}

export class DerivationTracker {
    private readonly nar?: NAR;
    private readonly logger: Logger;
    private recentDerivations: DerivationEntry[] = [];

    constructor(config: DerivationTrackerConfig = {}) {
        this.nar = config.nar;
        this.logger = config.logger ?? createLogger({scope: 'agent:derivations'});
    }

    captureDerivations(count: number): Promise<void> {
        return this.capture(count);
    }

    getRecentDerivations(): DerivationEntry[] {
        return [...this.recentDerivations];
    }

    clear(): void {
        this.recentDerivations = [];
    }

    private async capture(count: number): Promise<void> {
        if (!this.nar || count <= 0) return;
        try {
            const beliefs = this.nar.getBeliefs?.() ?? [];
            const recent = beliefs.slice(-count);
            for (const b of recent) {
                const entry: DerivationEntry = {
                    term: b.term.toString(),
                    truth: b.truth ? {f: b.truth.f, c: b.truth.c} : undefined,
                    timestamp: Date.now(),
                };
                this.recentDerivations.push(entry);
            }
            if (this.recentDerivations.length > MAX_RECENT_DERIVATIONS) {
                this.recentDerivations.splice(0, this.recentDerivations.length - MAX_RECENT_DERIVATIONS);
            }
        } catch {
            // derivation capture is best-effort
        }
    }
}
