import type { TaskBagKind } from '@senars/schemas';
import type { EventBus as InternalEventBus } from '@senars/events';
import type { IDriveManager } from '../../kernel/interfaces';
import { type Truth as TruthType } from '../../terms/impls/Truth';
import type { DriveState } from '../types';
export interface INarInput {
    input(input: string, type: TaskBagKind, truth?: TruthType): Promise<void>;
}
export declare class DriveManager implements IDriveManager {
    private states;
    private nar;
    private systemEventBus;
    constructor(nar: INarInput);
    setSystemEventBus(bus: InternalEventBus): void;
    updateCycle(): void;
    stimulate(driveId: string, amount: number): void;
    getState(driveId: string): DriveState | undefined;
    getAllStates(): DriveState[];
    getMaxIntensity(): number;
    getUrgency(): number;
    private injectDriveGoal;
}
//# sourceMappingURL=DriveManager.d.ts.map