import {clamp01} from '../utils';
import type {NAR} from '../nar.js';
import {BUILTIN_DRIVES} from './builtin.js';
import type {DriveSpec, DriveState} from './types.js';

export class DriveManager {
    private states = new Map<string, DriveState>();
    private nar: NAR;

    constructor(nar: NAR) {
        this.nar = nar;
        for (const spec of BUILTIN_DRIVES) {
            this.states.set(spec.id, {
                spec,
                currentIntensity: spec.targetIntensity,
                lastStimulation: Date.now(),
                isActive: true,
            });
        }
    }

    updateCycle(): void {
        for (const [, state] of this.states) {
            const truth = state.spec.computeTruth(state);

            const error = state.spec.targetIntensity - state.currentIntensity;
            state.currentIntensity += error * 0.1;
            state.currentIntensity *= 1 - state.spec.decayRate;
            state.currentIntensity = clamp01(state.currentIntensity);

            state.isActive = state.currentIntensity >= state.spec.activationThreshold;

            if (state.isActive) {
                this.injectDriveGoal(state.spec, truth);
            }
        }
    }

    stimulate(driveId: string, amount: number): void {
        const state = this.states.get(driveId);
        if (state) {
            state.currentIntensity = Math.min(1, state.currentIntensity + amount);
            state.lastStimulation = Date.now();
        }
    }

    getState(driveId: string): DriveState | undefined {
        return this.states.get(driveId);
    }

    getAllStates(): DriveState[] {
        return Array.from(this.states.values());
    }

    getMaxIntensity(): number {
        let max = 0;
        for (const [, state] of this.states) {
            if (state.currentIntensity > max) max = state.currentIntensity;
        }
        return max;
    }

    getUrgency(): number {
        let total = 0;
        let count = 0;
        for (const [, state] of this.states) {
            if (state.isActive) {
                total += state.currentIntensity;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    }

    private injectDriveGoal(spec: DriveSpec, truth: { f: number; c: number }): void {
        const narsese = `(self --> ${spec.goalProperty})! :${truth.f.toFixed(2)}:${truth.c.toFixed(2)}`;
        this.nar.input(narsese, 'goal', truth as any);
    }
}
