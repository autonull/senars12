import { clamp01, lerp, meanOf, retain } from '@senars/util/numeric';
import { maxScore } from '@senars/util/collections';
import { formatNarseseTruth } from '@senars/types/truth';
import { Truth } from '../../terms/impls/Truth';
import { BUILTIN_DRIVES } from './builtin';
export class DriveManager {
    states = new Map();
    nar;
    systemEventBus = null;
    constructor(nar) {
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
    setSystemEventBus(bus) {
        this.systemEventBus = bus;
    }
    updateCycle() {
        for (const [, state] of this.states) {
            const truth = state.spec.computeTruth(state);
            const error = state.spec.targetIntensity - state.currentIntensity;
            state.currentIntensity = lerp(state.currentIntensity, state.spec.targetIntensity, 0.1);
            state.currentIntensity = retain(state.currentIntensity, state.spec.decayRate);
            state.currentIntensity = clamp01(state.currentIntensity);
            state.isActive = state.currentIntensity >= state.spec.activationThreshold;
            if (state.isActive) {
                this.injectDriveGoal(state.spec, truth);
            }
        }
    }
    stimulate(driveId, amount) {
        const state = this.states.get(driveId);
        if (state) {
            const prevIntensity = state.currentIntensity;
            state.currentIntensity = clamp01(state.currentIntensity + amount);
            state.lastStimulation = Date.now();
            if (amount !== 0 && this.systemEventBus) {
                this.systemEventBus.emit('nar:drive:changed', {
                    drive: driveId,
                    urgency: Math.abs(state.currentIntensity - prevIntensity),
                    timestamp: Date.now(),
                });
            }
        }
    }
    getState(driveId) {
        return this.states.get(driveId);
    }
    getAllStates() {
        return Array.from(this.states.values());
    }
    getMaxIntensity() {
        return maxScore(this.states.values(), (s) => s.currentIntensity);
    }
    getUrgency() {
        return meanOf([...this.states.values()].filter((s) => s.isActive), (s) => s.currentIntensity);
    }
    injectDriveGoal(spec, truth) {
        const narsese = `(self-->${spec.goalProperty})!${formatNarseseTruth(truth)}`;
        this.nar.input(narsese, 'goal', Truth.create(truth.f, truth.c));
    }
}
