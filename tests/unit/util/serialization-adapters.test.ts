import {PriorityBag} from '@senars/nar/bag';
import {factorySerializable, inPlaceSerializable} from '@senars/util/utils/serialization';
import {describe, expect, it} from 'vitest';

describe('serialization adapters', () => {
    it('factorySerializable wraps PriorityBag (static deserialize) without changing its API', () => {
        const bag = new PriorityBag<{id: string; priority: number}>({capacity: 3});
        bag.add({id: '1', priority: 0.5});
        bag.add({id: '2', priority: 0.8});

        const adapter = factorySerializable<ReturnType<PriorityBag<{id: string; priority: number}>['serialize']>, PriorityBag<{id: string; priority: number}>>({
            serialize: () => ({items: [...bag.entries()], capacity: bag.capacity, decayRate: 0.01, forgetRate: 0.001}),
            factory: (data) => {
                const restored = new PriorityBag<{id: string; priority: number}>({capacity: data.capacity, decayRate: data.decayRate, forgetRate: data.forgetRate});
                for (const [item, priority] of data.items) {
                    restored.add({id: item.id, priority});
                }
                return restored;
            },
        });

        const state = adapter.serialize();
        expect(state.items.length).toBe(2);

        const restored = adapter.deserialize(state);
        expect(restored.current).toBeInstanceOf(PriorityBag);
        expect(restored.current.size()).toBe(2);
    });

    it('inPlaceSerializable wraps a void-deserialize instance', () => {
        class VoidDeserialize {
            private value = 1;

            serialize() {
                return {value: this.value};
            }

            deserialize(data: { value: number }): void {
                this.value = data.value;
            }
        }

        const instance = new VoidDeserialize();
        const adapter = inPlaceSerializable(instance);
        expect(() => adapter.deserialize({value: 9})).not.toThrow();
        expect(instance.serialize().value).toBe(9);
    });
});
