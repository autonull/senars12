import { builtinLensSpecs } from '../../shared/lens-schema.js';
import { channel, compose, field, konst, union, when } from './operators.js';
import type { ChannelValue, Item, Modulation, View } from './types.js';

export interface LensSpec {
  id: string;
  label: string;
  description: string;
  modulation: ModulationSpec;
}

export type ModulationSpec =
  | { op: 'const'; value: ChannelValue }
  | { op: 'field'; field: string; map?: string }
  | { op: 'channel'; channel: string; child: ModulationSpec }
  | { op: 'when'; predicate: string; child: ModulationSpec }
  | { op: 'union'; children: ModulationSpec[] };

const SCALE_MAP_NAMES: Record<string, (v: unknown) => ChannelValue> = {
  'truth-to-color': (v: unknown) => {
    const f = (v as { frequency?: number })?.frequency ?? 0.5;
    return `hsl(${Math.round(f * 120)}, 70%, 50%)`;
  },
  'priority-to-size': (v: unknown) => Math.max(10, Math.min(60, (v as number) * 50 + 10)),
  'confidence-to-opacity': (v: unknown) => 0.3 + 0.7 * (v as number),
  'time-to-depth': (v: unknown) => {
    const t = v as number;
    return t !== undefined ? t / 1000 : 0;
  },
};

function isItemField(f: string): f is keyof Item {
  return [
    'id',
    'priority',
    'confidence',
    'nodeType',
    'isContradiction',
    'occurrenceTime',
    'goalRelevance',
    'edgeType',
    'weight',
    'source',
    'target',
    'directed',
  ].includes(f);
}

function compileSpec(spec: ModulationSpec): Modulation {
  switch (spec.op) {
    case 'const':
      return konst(spec.value);
    case 'field': {
      if (!isItemField(spec.field)) return konst(0);
      const mapFn = spec.map ? SCALE_MAP_NAMES[spec.map] : undefined;
      return field(spec.field, mapFn);
    }
    case 'channel':
      return channel(spec.channel as never, compileSpec(spec.child));
    case 'when': {
      const predicate = compilePredicate(spec.predicate);
      return when(predicate, compileSpec(spec.child));
    }
    case 'union':
      return union(spec.children.map(compileSpec));
  }
}

function compilePredicate(predicate: string): (item: Item, view: View) => boolean {
  if (predicate === 'isContradiction') {
    return (item: Item) => item.isContradiction === true;
  }
  if (predicate.startsWith('truth.f > ')) {
    const threshold = Number.parseFloat(predicate.slice('truth.f > '.length));
    return (item: Item) => (item.truth?.frequency ?? 0) > threshold;
  }
  if (predicate.startsWith('occurrenceTime ≤ view.timeline.t')) {
    return (item: Item, view: View) => (item.occurrenceTime ?? 0) <= view.timeline.t;
  }
  if (predicate.startsWith('occurrenceTime > view.timeline.t')) {
    return (item: Item, view: View) =>
      (item.occurrenceTime ?? Number.POSITIVE_INFINITY) > view.timeline.t;
  }
  return () => true;
}

export function compile(spec: LensSpec): Modulation {
  return compileSpec(spec.modulation);
}

/** Built-in lens modulations compiled from the shared lens specs (single source of truth). */
export function builtinLensModulations(): Record<string, Modulation> {
  return Object.fromEntries(
    builtinLensSpecs().map((spec) => [spec.id, compileSpec(spec.modulation)])
  );
}

export const beliefLens = (): Modulation => builtinLensModulations().belief ?? konst(0);
export const goalLens = (): Modulation => builtinLensModulations().goal ?? konst(0);
export const contradictionLens = (): Modulation =>
  builtinLensModulations().contradiction ?? konst(0);
export const temporalLens = (): Modulation => builtinLensModulations().temporal ?? konst(0);
