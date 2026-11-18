import { assertDefined, KeyedRegistry } from '@senars/util';
import type { CognitionAction, CognitionContext, Reward, Sensor } from './types.js';

/**
 * C1: component registries. Named, seeded, addressable; games compose specs
 * from these (R1). Registration is idempotent per id.
 */
export class ComponentRegistry<T extends { readonly id: string }> extends KeyedRegistry<T> {
  constructor() {
    super({ keyOf: (component) => component.id });
  }

  require(id: string): T {
    return assertDefined(this.get(id), `component not registered: ${id}`);
  }
}

export class SensorRegistry extends ComponentRegistry<Sensor> {}
export class ActionRegistry extends ComponentRegistry<CognitionAction> {}
export class RewardRegistry extends ComponentRegistry<Reward> {}

export const createCognitionRegistries = (): {
  sensors: SensorRegistry;
  actions: ActionRegistry;
  rewards: RewardRegistry;
} => ({
  sensors: new SensorRegistry(),
  actions: new ActionRegistry(),
  rewards: new RewardRegistry(),
});
