import type { CognitionAction, CognitionContext, Reward, Sensor } from './types.js';

/**
 * C1: component registries. Named, seeded, addressable; games compose specs
 * from these (R1). Registration is idempotent per id.
 */
export class ComponentRegistry<T extends { readonly id: string }> {
  private readonly components = new Map<string, T>();

  register(component: T): this {
    this.components.set(component.id, component);
    return this;
  }

  get(id: string): T | undefined {
    return this.components.get(id);
  }

  require(id: string): T {
    const c = this.components.get(id);
    if (!c) throw new Error(`component not registered: ${id}`);
    return c;
  }

  all(): T[] {
    return [...this.components.values()];
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
