import { type Clock } from '@senars/util/clock';
import type { Bag, BagItem } from '@senars/bag';
import type { Game } from '../game/Game';
import type { GateRegistry } from '../kernel/index';
import type { NALDerivation } from '../reflex/negotiation-types';
import type { Reflex } from '../reflex/Reflex';
import type { RandomSource } from '../types/primitives';
import { type FocusConcept, type FocusTask } from './task';
export type { FocusConcept, FocusTask } from './task';
export interface FocusStepReport {
    focusId: string;
    cycle: number;
    budgetAllocated: number;
    tasksProcessed: number;
    derivations: number;
    beliefsAdded: number;
    goalsAdded: number;
    questionsAdded: number;
    /** Tasks projected into the bag, by record kind. Admission counts, not gate decisions. */
    projected: {
        perceptions: number;
        actions: number;
        rewards: number;
    };
    timestamp: number;
}
export interface FocusOptions {
    id: string;
    taskCapacity?: number;
    conceptCapacity?: number;
    taskDecayRate?: number;
    conceptDecayRate?: number;
    weight?: number;
    /** Required: a focus admits and rewards through gates the owner chose (TODO19 F2, TODO33 §5.P2.7). */
    gateRegistry: GateRegistry;
    /** P1 (TODO20): injectable RNG for deterministic replay of task/memory sampling. */
    rng?: RandomSource;
    /** Injectable time source for task stamps; a pinned clock reproduces a step's ids. */
    clock?: Clock;
}
export declare class Focus implements BagItem {
    readonly id: string;
    readonly tasks: Bag<FocusTask>;
    readonly memory: Bag<FocusConcept>;
    weight: number;
    private cycle;
    private gates;
    private readonly clock;
    readonly games: Game[];
    reflexes: Reflex[];
    constructor(options: FocusOptions);
    get priority(): number;
    setWeight(weight: number): void;
    step(budget: number): Promise<FocusStepReport>;
    private processTasks;
    private addConcept;
    bindGame(game: Game): void;
    bindReflex(reflex: Reflex): void;
    disableReflex(reflexId: string): void;
    private readonly conceptsById;
    private readonly derivationsByAction;
    private indexVersion;
    /**
     * Both views of the focus memory, from one pass, rebuilt only when it mutates.
     *
     * The version guard was here for derivations alone (X23); the by-id lookup was
     * still a linear scan of the whole memory for every belief a tick admitted, so
     * the two views shared a trigger and a rebuild and were not built together.
     */
    private rebuildIndexes;
    private recordDerivations;
    /** Derivations relevant to an action, served from the index, not by scanning. */
    getNALDerivations(action: string): NALDerivation[];
}
//# sourceMappingURL=Focus.d.ts.map