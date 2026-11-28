/**
 * The declarative catalogue of every built-in strategy (TODO27 §2.1).
 *
 * A strategy that is not declared here is not configurable; a strategy that is
 * declares what it accepts. Adding a strategy is one entry — nothing else in
 * the system learns its name, and the catalogue is the only place that knows a
 * strategy's default configuration.
 */
import { type StrategyRegistration } from '../../strategies/registration';
import type { StrategyType } from '../../strategies/types';
export type StrategySlotEntry = readonly [StrategyType, StrategyRegistration];
export type StrategySlot = readonly StrategySlotEntry[];
export declare const DEFAULT_REGISTRATIONS: StrategySlot;
//# sourceMappingURL=registrations.d.ts.map