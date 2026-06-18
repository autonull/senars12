const fs = require('fs');
let code = fs.readFileSync('src/nar/types/core.ts', 'utf8');

// Add branded types
const brandTypes = `
// Branded types for temporal and probabilistic reasoning safety
export type Timestamp = number & { readonly __brand: unique symbol };
export type Duration = number & { readonly __brand: unique symbol };

export const createTimestamp = (ms?: number): Timestamp => (ms ?? Date.now()) as Timestamp;
export const createDuration = (ms: number): Duration => ms as Duration;
`;

code = code.replace('export type Hash = number;', brandTypes + '\nexport type Hash = number;');

// Update Task interface
code = code.replace('readonly occurrenceTime: number;', 'readonly occurrenceTime: Timestamp;');

// Update createTask
code = code.replace('occurrenceTime: Date.now(),', 'occurrenceTime: createTimestamp(),');

// Update createSecondaryTask
code = code.replace('occurrenceTime: 0,', 'occurrenceTime: createTimestamp(0),');

fs.writeFileSync('src/nar/types/core.ts', code);
