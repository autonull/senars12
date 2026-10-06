import { KeyedRegistry, type KeyedRegistryOptions } from '@senars/util';
import { withDefaults } from '@senars/util/config';
import { describe, expect, it } from 'vitest';

interface Sensor {
  readonly id: string;
  readonly reading: number;
}

const sensor = (id: string, reading = 0): Sensor => ({ id, reading });

describe('KeyedRegistry', () => {
  const registry = (onDuplicate?: KeyedRegistryOptions<Sensor>['onDuplicate']) =>
    new KeyedRegistry<Sensor>({ keyOf: (s) => s.id, onDuplicate });

  it('files an item under the key its own identity declares', () => {
    const sensors = registry();
    sensors.register(sensor('a', 1));
    expect(sensors.get('a')?.reading).toBe(1);
    expect(sensors.keys()).toEqual(['a']);
    expect(sensors.all()).toHaveLength(1);
  });

  it('keeps the last registration of a repeated key when no policy is declared', () => {
    const sensors = registry();
    sensors.register(sensor('a', 1)).register(sensor('a', 2));
    expect(sensors.all()).toEqual([sensor('a', 2)]);
  });

  it('reports a repeated key to the declared policy with the incumbent', () => {
    const seen: [string, Sensor][] = [];
    const sensors = registry((key, incumbent) => seen.push([key, incumbent]));
    sensors.register(sensor('a', 1)).register(sensor('a', 2));
    expect(seen).toEqual([['a', sensor('a', 1)]]);
  });

  it('lets a throwing policy refuse the registration', () => {
    const sensors = registry((key) => {
      throw new Error(`duplicate ${key}`);
    });
    sensors.register(sensor('a'));
    expect(() => sensors.register(sensor('a'))).toThrow('duplicate a');
    expect(sensors.all()).toEqual([sensor('a')]);
  });

  it('preserves registration order and drops a deleted key', () => {
    const sensors = registry();
    sensors.register(sensor('b')).register(sensor('a')).register(sensor('c'));
    expect(sensors.delete('a')).toBe(true);
    expect(sensors.keys()).toEqual(['b', 'c']);
    expect(sensors.has('a')).toBe(false);
  });
});

describe('withDefaults', () => {
  interface Options {
    name: string;
    port: number;
    greeting?: string;
  }

  const defaults: Options = { name: 'HTTP', port: 8080 };

  it('answers every declared key when the caller supplied nothing', () => {
    expect(withDefaults<Options>({}, defaults)).toEqual({ name: 'HTTP', port: 8080 });
  });

  it('overlays a supplied value on its default', () => {
    expect(withDefaults<Options>({ port: 9000 }, defaults)).toEqual({ name: 'HTTP', port: 9000 });
  });

  it('treats a null or undefined value as the absence of a value', () => {
    const config = { name: undefined, port: null };
    expect(withDefaults<Options>(config, defaults)).toEqual({ name: 'HTTP', port: 8080 });
  });

  it('carries a key the defaults omit once it is supplied', () => {
    expect(withDefaults<Options>({ greeting: 'hi' }, defaults).greeting).toBe('hi');
    expect(withDefaults<Options>({}, defaults).greeting).toBeUndefined();
  });

  it('leaves the defaults object untouched', () => {
    withDefaults<Options>({ name: 'WS', port: 1 }, defaults);
    expect(defaults).toEqual({ name: 'HTTP', port: 8080 });
  });
});
