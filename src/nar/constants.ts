export const THRESHOLDS = Object.freeze({
    PRIORITY: Object.freeze({LOW: 0.3, MEDIUM: 0.7, HIGH: 0.9}),
    MERGE: 0.85,
    ARCHIVE: 0.2,
    PRESSURE: 0.9,
    TEMPORAL_RESOLUTION: 1000,
    DECAY_TIME_CONSTANT: 60000,
} as const);