import type {Truth} from '../terms/truth.js';

export interface DriveSpec {
    id: string;
    name: string;
    description: string;
    goalProperty: string;
    targetIntensity: number;
    decayRate: number;
    activationThreshold: number;
    computeTruth: (state: DriveState) => Truth;
}

export interface DriveState {
    spec: DriveSpec;
    currentIntensity: number;
    lastStimulation: number;
    isActive: boolean;
}
