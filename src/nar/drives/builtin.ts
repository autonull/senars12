import {Truth} from '../terms/truth.js';
import type {DriveSpec} from './types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export const BUILTIN_DRIVES: DriveSpec[] = [
    {
        id: 'curiosity',
        name: 'Curiosity',
        description: 'Seek unknowns, reduce uncertainty',
        goalProperty: 'curious',
        targetIntensity: 0.7,
        decayRate: 0.02,
        activationThreshold: 0.3,
        computeTruth: (state) => {
            const f = clamp(state.currentIntensity, 0.1, 0.9);
            const c = 0.6 + 0.3 * (1 - state.currentIntensity);
            return Truth.create(f, c);
        },
    },
    {
        id: 'competence',
        name: 'Competence',
        description: 'Improve reasoning success rate',
        goalProperty: 'competent',
        targetIntensity: 0.8,
        decayRate: 0.015,
        activationThreshold: 0.3,
        computeTruth: (state) => {
            const f = 1 - state.currentIntensity;
            return Truth.create(clamp(f, 0.1, 0.9), 0.7);
        },
    },
    {
        id: 'coherence',
        name: 'Coherence',
        description: 'Reduce contradictions',
        goalProperty: 'coherent',
        targetIntensity: 0.9,
        decayRate: 0.01,
        activationThreshold: 0.2,
        computeTruth: (state) => {
            return Truth.create(clamp(state.currentIntensity, 0.05, 0.8), 0.8);
        },
    },
    {
        id: 'social',
        name: 'Social Engagement',
        description: 'Maintain interaction recency',
        goalProperty: 'social',
        targetIntensity: 0.5,
        decayRate: 0.05,
        activationThreshold: 0.2,
        computeTruth: (state) => {
            const hoursSince = (Date.now() - state.lastStimulation) / 3.6e6;
            const f = clamp(1 - Math.exp(-hoursSince / 24), 0.1, 0.8);
            return Truth.create(f, 0.5);
        },
    },
];
