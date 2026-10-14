/**
 * Intent catalog — one action model replacing both UiSignals (eventBus) and Command registry.
 *
 * Every registrable action is an Intent with:
 * - id: unique identifier
 * - title: display label
 * - group: palette grouping
 * - kind: 'signal' | 'command' — signals fire-and-forget; commands have args & validation
 * - run: (args) => void — the action body
 * - available?: () => boolean — runtime availability gate
 * - parse?: (args) => args — arg validation/coercion (for commands)
 * - paletteHidden?: boolean — exclude from palette but keep dispatchable
 * - keywords?: string — extra search terms
 * - schema?: ZodSchema — for agent validation
 *
 * The palette is a filtered view: all intents where !paletteHidden and available().
 * eventBus.emit(signal) becomes dispatch(signal, payload).
 * dispatchCommand(id, args) becomes dispatch(id, args).
 */
import { z, type ZodSchema, type ZodType } from 'zod';
import { defineCatalog, type Catalog } from './catalog.js';

/** Signal payload is void or an object. */
export type SignalPayload = void | string | number | boolean | Record<string, unknown>;

/** Command args are always an object. */
export type CommandArgs = Record<string, unknown>;

/** All intent payloads. */
export type IntentPayload = SignalPayload | CommandArgs;

export type IntentKind = 'signal' | 'command';

/** Base descriptor shared by all intents. */
export interface BaseIntentDescriptor<K extends string = string> {
  readonly id: K;
  readonly title: string;
  readonly label: string; // For catalog compatibility
  readonly group: string;
  readonly kind: IntentKind;
  readonly run: (args: IntentPayload) => void | Promise<void>;
  readonly available?: () => boolean;
  readonly parse?: (args: CommandArgs) => CommandArgs;
  readonly paletteHidden?: boolean;
  readonly keywords?: string;
  readonly schema?: ZodType;
  readonly icon?: string;
  /** Index signature for catalog compatibility. */
  readonly [key: string]: unknown;
}

/** Signal descriptor — fire-and-forget, optional payload. */
export interface SignalDescriptor<K extends string = string> extends BaseIntentDescriptor<K> {
  readonly kind: 'signal';
  readonly run: (args: IntentPayload) => void | Promise<void>;
  readonly paletteHidden: true;
}

/** Command descriptor — with args, validation, palette metadata. */
export interface CommandDescriptor<K extends string = string> extends BaseIntentDescriptor<K> {
  readonly kind: 'command';
  readonly run: (args: IntentPayload) => void | Promise<void>;
  readonly parse?: (args: CommandArgs) => CommandArgs;
}

/** Union of all intent descriptor types. */
export type IntentDescriptor<K extends string = string> = SignalDescriptor<K> | CommandDescriptor<K>;

/** The one dispatch entry point. */
export type IntentDispatch = (id: string, args?: IntentPayload) => boolean;

/** Intent catalog with the unified dispatch. */
export interface IntentCatalog<K extends string, D extends IntentDescriptor<K>>
  extends Catalog<Record<K, D>> {
  dispatch: IntentDispatch;
  /** Palette-visible commands (not signals, not hidden, available). */
  readonly paletteIntents: () => D[];
  /** All dispatchable intents (commands + signals). */
  readonly allIntents: () => D[];
}

/** Create the intent catalog with built-in dispatch. */
export function defineIntentCatalog<K extends string, D extends IntentDescriptor<K>>(
  defs: Record<K, D>
): IntentCatalog<K, D> {
  const catalog = defineCatalog(defs);

  const dispatch: IntentDispatch = (id, args = {}) => {
    const intent = catalog.get(id as K);
    if (!intent) {
      console.warn(`[intent] Unknown intent: ${id}`);
      return false;
    }
    if (intent.available?.() === false) {
      console.warn(`[intent] ${id} not available`);
      return false;
    }
    try {
      const parsedArgs = intent.parse ? intent.parse(args as CommandArgs) : args;
      intent.run(parsedArgs);
      return true;
    } catch (error) {
      console.warn(`[intent] ${id} rejected:`, error);
      return false;
    }
  };

  return {
    ...catalog,
    dispatch,
    paletteIntents: () =>
      catalog.ids
        .map((id) => catalog.get(id))
        .filter(
          (i): i is D =>
            i !== undefined &&
            i.kind === 'command' &&
            !i.paletteHidden &&
            i.available?.() !== false
        ),
    allIntents: () => catalog.ids.map((id) => catalog.get(id)).filter((i): i is D => i !== undefined),
  };
}

/** Type-safe intent registration helper. */
export function createIntent<K extends string, D extends IntentDescriptor<K>>(
  spec: D
): D {
  return spec as D;
}

/** Signal shorthand — optional payload, no palette entry, no validation. */
export function signal<K extends string, P = void>(
  id: K,
  title: string,
  group: string,
  run: (args: P) => void | Promise<void>,
  available?: () => boolean
): IntentDescriptor<K> {
  return {
    id,
    title,
    label: title,
    group,
    kind: 'signal' as const,
    run: run as (args: IntentPayload) => void | Promise<void>,
    available,
    paletteHidden: true,
  };
}

/** Command shorthand — with args, validation, palette metadata. */
export function command<K extends string>(
  id: K,
  title: string,
  group: string,
  run: (args: IntentPayload) => void | Promise<void>,
  options?: {
    available?: () => boolean;
    parse?: (args: CommandArgs) => CommandArgs;
    paletteHidden?: boolean;
    keywords?: string;
    icon?: string;
    schema?: ZodType;
  }
): IntentDescriptor<K> {
  return {
    id,
    title,
    label: title,
    group,
    kind: 'command' as const,
    run,
    available: options?.available,
    parse: options?.parse,
    paletteHidden: options?.paletteHidden,
    keywords: options?.keywords,
    icon: options?.icon,
    schema: options?.schema,
  };
}

/** Combined shorthand for both kinds. */
export function intent<K extends string>(spec: IntentDescriptor<K>): IntentDescriptor<K> {
  return spec;
}

/** Global intent registry for bundle registration. */
const intentRegistry = new Map<string, IntentDescriptor>();

/** Register an intent globally (for bundle system). */
export function registerIntent(intent: IntentDescriptor): void {
  if (intentRegistry.has(intent.id)) {
    throw new Error(`Intent with id "${intent.id}" already registered`);
  }
  intentRegistry.set(intent.id, intent);
}

/** Get an intent by id. */
export function intentFor(id: string): IntentDescriptor | undefined {
  return intentRegistry.get(id);
}

/** All registered intents. */
export function getIntents(): readonly IntentDescriptor[] {
  return [...intentRegistry.values()];
}

/** All intent ids. */
export function intentIds(): readonly string[] {
  return [...intentRegistry.keys()];
}

/** Reset intent registry (for testing). */
export function resetIntents(): void {
  intentRegistry.clear();
}

/** Build an intent catalog from the global registry. */
export function buildIntentCatalog(): IntentCatalog<string, IntentDescriptor> {
  const defs = Object.fromEntries(intentRegistry) as Record<string, IntentDescriptor>;
  return defineIntentCatalog(defs);
}