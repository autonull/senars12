import type { Channel, ChannelValue, Delta, Item, Modulation, View } from './types.js';

export function evaluateModulation(mod: Modulation, item: Item, view: View): Delta {
  const delta: Delta = new Map();
  applyModulation(mod, item, view, delta);
  return delta;
}

function applyModulation(mod: Modulation, item: Item, view: View, out: Delta): void {
  switch (mod.op) {
    case 'channel':
      applyChannel(mod.channel, mod.child, item, view, out);
      break;
    case 'when':
      if (mod.predicate(item, view)) {
        applyModulation(mod.child, item, view, out);
      }
      break;
    case 'union':
      for (const child of mod.children) {
        applyModulation(child, item, view, out);
      }
      break;
  }
}

function applyChannel(
  channel: Channel,
  child: Modulation,
  item: Item,
  view: View,
  out: Delta
): void {
  const value = resolveModulationValue(child, item, view);
  if (value === undefined) return;
  let record = out.get(item.id);
  if (!record) {
    record = {};
    out.set(item.id, record);
  }
  record[channel] = value;
}

function resolveModulationValue(mod: Modulation, item: Item, view: View): ChannelValue | undefined {
  switch (mod.op) {
    case 'const':
      return mod.value;
    case 'field': {
      const raw = item[mod.field];
      return mod.map ? mod.map(raw) : (raw as ChannelValue);
    }
    default:
      return undefined;
  }
}

export function konst(value: ChannelValue): Modulation {
  return { op: 'const', value };
}

export function field(f: keyof Item, map?: (v: unknown) => ChannelValue): Modulation {
  return { op: 'field', field: f, map };
}

export function channel(ch: Channel, child: Modulation): Modulation {
  return { op: 'channel', channel: ch, child };
}

export function when(
  predicate: (item: Item, view: View) => boolean,
  child: Modulation
): Modulation {
  return { op: 'when', predicate, child };
}

export function union(children: Modulation[]): Modulation {
  return { op: 'union', children };
}

export function memo(id: string, child: Modulation): Modulation {
  return { op: 'memo', id, child };
}

/**
 * Combine modulations left-to-right; later assignments to the same channel win.
 * The identity for ⊕ is nothing (empty delta).
 */
export function compose(...modulations: Modulation[]): Modulation {
  return union(modulations);
}
