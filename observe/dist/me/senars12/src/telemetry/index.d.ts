import type { GateName, GateOutcome } from '@senars/schemas/gate-io';
/**
 * O1/O4: one call per gate verdict — Prometheus counter + fire-and-forget span.
 *
 * `correlationId` rides the span only: as a Prometheus label it would mint a
 * series per utterance, and a counter nobody can join to the events that explain
 * it is the thing §2 of TODO33 set out to fix.
 *
 * It arrives as a thunk because a budget charge is one candidate rule, and minting
 * an id and an attributes literal per charge to hand a tracer nobody installed was
 * ~10k discarded ids per cycle. The thunk is memoized, so when a collector *is*
 * attached the span still carries the id the refusal event carries.
 */
export declare function recordGateDecision(gate: GateName, operation: string, { granted, reason }: GateOutcome, correlation?: string | (() => string)): void;
export declare function recordSchemaPromotion(scope: string, count: number): void;
export declare function recordHandover(): void;
export declare function pressureToString(pressure: number): string;
export declare function pressureToNumber(pressure: string): number;
export declare function recordBagPressure(bag: string, pressure: number): void;
//# sourceMappingURL=index.d.ts.map