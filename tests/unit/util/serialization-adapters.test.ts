import { describe, it, expect } from 'vitest';
import { Bag } from '@senars/nar';
import { factorySerializable, inPlaceSerializable } from '@senars/util/utils/serialization';

describe('serialization adapters', () => {
  it('factorySerializable wraps Bag (static deserialize) without changing its API', () => {
    const bag = new Bag<number>(3, { overflowBehavior: 'reject' });
    bag.add(1, 0.5);
    bag.add(2, 0.8);

    const adapter = factorySerializable<ReturnType<Bag<number>['serialize']>, Bag<number>>({
      serialize: () => bag.serialize(),
      factory: (data) => Bag.deserialize(data),
    });

    const state = adapter.serialize();
    expect(state.items.length).toBe(2);

    const restored = adapter.deserialize(state);
    expect(restored.current).toBeInstanceOf(Bag);
    expect(restored.current.serialize().items.length).toBe(2);
  });

  it('inPlaceSerializable wraps a void-deserialize instance', () => {
    class VoidDeserialize {
      private value = 1;
      serialize() {
        return { value: this.value };
      }
      deserialize(data: { value: number }): void {
        this.value = data.value;
      }
    }
    const instance = new VoidDeserialize();
    const adapter = inPlaceSerializable(instance);
    expect(() => adapter.deserialize({ value: 9 })).not.toThrow();
    expect(instance.serialize().value).toBe(9);
  });
});
