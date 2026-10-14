/**
 * Protocol registry — one message shape, both ends.
 *
 * Replaces:
 *   - server `handleClientMessage` switch (30 cases)
 *   - client `applyServerMessage` switch (15 cases)
 *   - hand-written validation in both places
 *
 * A protocol entry is:
 *   - type: the discriminator (string literal)
 *   - direction: 'toServer' | 'toClient'
 *   - schema: zod schema for validation
 *   - handle: the handler (server: ctx + msg; client: msg + optional cy)
 *
 * The server validates inbound frames with the schema; the client routes
 * inbound frames through the same registry. One definition, two dispatchers.
 */
import { z, type ZodType } from 'zod';

/** Message direction. */
export type MessageDirection = 'toServer' | 'toClient';

/** Base descriptor shared by all protocol messages. */
export interface BaseMessageDescriptor<K extends string = string> {
  readonly type: K;
  readonly direction: MessageDirection;
  readonly schema: ZodType;
  readonly [key: string]: unknown;
}

/** Server message descriptor — handler receives context and parsed message. */
export interface ServerMessageDescriptor<K extends string = string> extends BaseMessageDescriptor<K> {
  readonly direction: 'toServer';
  readonly handle: (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>;
}

/** Client message descriptor — handler receives parsed message and optional cytoscape. */
export interface ClientMessageDescriptor<K extends string = string> extends BaseMessageDescriptor<K> {
  readonly direction: 'toClient';
  readonly handle: (msg: unknown, cy?: unknown) => void | Promise<void>;
}

/** Union of both descriptor types. */
export type MessageDescriptor<K extends string = string> = ServerMessageDescriptor<K> | ClientMessageDescriptor<K>;

/** Server handler context. */
export interface ServerHandlerContext {
  readonly agent: unknown;
  readonly projection: unknown;
  readonly ws: unknown;
  readonly nar: () => unknown;
  readonly activeRun: { current: unknown };
  readonly wss: { clients: Set<unknown> };
  readonly currentNarConfig: Record<string, unknown>;
  readonly DEFAULT_RUN_CYCLES: number;
  readonly ASK_RUN_CYCLES: number;
}

/** Protocol entry for catalog — flat shape with label for compatibility. */
export interface ProtocolEntry<K extends string = string> {
  readonly label: string;
  readonly type: K;
  readonly direction: MessageDirection;
  readonly schema: ZodType;
  readonly handleServer?: (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>;
  readonly handleClient?: (msg: unknown, cy?: unknown) => void | Promise<void>;
}

/** Protocol catalog definition. */
export type ProtocolDefinition = Readonly<Record<string, ProtocolEntry>>;

/** Protocol catalog with server/client dispatch. */
export interface ProtocolCatalog<Def extends ProtocolDefinition> {
  /** The raw definition (frozen). */
  readonly definition: Def;
  /** Get an entry by key. */
  readonly get: <K extends keyof Def>(key: K) => Def[K];
  /** All keys in catalog order. */
  readonly ids: readonly (keyof Def)[];
  /** All entries in catalog order. */
  readonly entries: readonly Def[keyof Def][];
  /** Filter keys by a predicate on the entry. */
  readonly where: (predicate: (entry: Def[keyof Def]) => boolean) => (keyof Def)[];
  /** Number of entries. */
  readonly size: number;
  /** Check if a key exists. */
  readonly has: (key: string) => boolean;
  /** Server-side: validate and dispatch to handler. */
  readonly handleServer: (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>;
  /** Client-side: validate and dispatch to handler. */
  readonly handleClient: (msg: unknown, cy?: unknown) => void | Promise<void>;
  /** Validate a message without dispatching. */
  readonly validate: (msg: unknown) => { success: boolean; error?: string; type?: string };
}

/** Create the protocol catalog with built-in server/client dispatch. */
export function defineProtocolCatalog<const Def extends ProtocolDefinition>(defs: Def): ProtocolCatalog<Def> {
  const entries = Object.entries(defs) as [keyof Def, Def[keyof Def]][];
  const ids = entries.map(([id]) => id);

  const catalog: ProtocolCatalog<Def> = {
    definition: defs,
    get: <K extends keyof Def>(key: K) => defs[key],
    ids: Object.freeze(ids),
    entries: Object.freeze(entries.map(([, entry]) => entry)),
    where: (predicate) => ids.filter((id) => predicate(defs[id])),
    size: ids.length,
    has: (key) => key in defs,
    handleServer: async (ctx: ServerHandlerContext, msg: unknown) => {
      if (!msg || typeof msg !== 'object' || !('type' in msg)) {
        console.warn('[protocol] Invalid server message: must have a type field');
        return;
      }
      const type = (msg as Record<string, unknown>).type as string;
      const entry = defs[type as keyof Def];
      if (!entry) {
        console.warn('[protocol] Unknown server message type:', type);
        return;
      }
      const result = entry.schema.safeParse(msg);
      if (!result.success) {
        console.warn('[protocol] Server message failed validation:', result.error);
        return;
      }
      if (entry.direction === 'toServer' && entry.handleServer) {
        try {
          await entry.handleServer(ctx, msg);
        } catch (error) {
          console.error(`[protocol] Handler error for ${type}:`, error);
        }
      }
    },
    handleClient: async (msg: unknown, cy?: unknown) => {
      if (!msg || typeof msg !== 'object' || !('type' in msg)) {
        console.warn('[protocol] Invalid client message: must have a type field');
        return;
      }
      const type = (msg as Record<string, unknown>).type as string;
      const entry = defs[type as keyof Def];
      if (!entry) {
        console.warn('[protocol] Unknown client message type:', type);
        return;
      }
      const result = entry.schema.safeParse(msg);
      if (!result.success) {
        console.warn('[protocol] Client message failed validation:', result.error);
        return;
      }
      if (entry.direction === 'toClient' && entry.handleClient) {
        try {
          await entry.handleClient(msg, cy);
        } catch (error) {
          console.error(`[protocol] Client handler error for ${type}:`, error);
        }
      }
    },
    validate: (msg: unknown) => {
      if (!msg || typeof msg !== 'object' || !('type' in msg)) {
        return { success: false, error: 'Message must have a type field' };
      }
      const type = (msg as Record<string, unknown>).type as string;
      const entry = defs[type as keyof Def];
      if (!entry) {
        return { success: false, error: `Unknown message type: ${type}`, type };
      }
      const result = entry.schema.safeParse(msg);
      if (!result.success) {
        return {
          success: false,
          error: `Message failed protocol validation: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          type,
        };
      }
      return { success: true, type };
    },
  };

  return catalog;
}

/** Type-safe registration helper for server messages. */
export function serverMessage<K extends string, S extends ZodType>(
  spec: {
    type: K;
    schema: S;
    handle: (ctx: ServerHandlerContext, msg: z.infer<S>) => void | Promise<void>;
  }
): ServerMessageDescriptor<K> {
  return {
    type: spec.type,
    direction: 'toServer',
    schema: spec.schema,
    handle: spec.handle as (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>,
  };
}

/** Type-safe registration helper for client messages. */
export function clientMessage<K extends string, S extends ZodType>(
  spec: {
    type: K;
    schema: S;
    handle: (msg: z.infer<S>, cy?: unknown) => void | Promise<void>;
  }
): ClientMessageDescriptor<K> {
  return {
    type: spec.type,
    direction: 'toClient',
    schema: spec.schema,
    handle: spec.handle as (msg: unknown, cy?: unknown) => void | Promise<void>,
  };
}

/** Create a protocol entry with label for catalog compatibility. */
export function createProtocolEntry<K extends string, S extends ZodType>(
  spec: {
    type: K;
    label: string;
    direction: MessageDirection;
    schema: S;
    handleServer?: (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>;
    handleClient?: (msg: unknown, cy?: unknown) => void | Promise<void>;
  }
): ProtocolEntry<K> {
  return {
    label: spec.label,
    type: spec.type,
    direction: spec.direction,
    schema: spec.schema,
    handleServer: spec.handleServer,
    handleClient: spec.handleClient,
  };
}

/** Extract the key union from a protocol catalog. */
export type ProtocolKey<C extends ProtocolCatalog<any>> = C extends ProtocolCatalog<infer Def>
  ? keyof Def
  : never;

/** Registry of protocol entries. */
const protocolRegistry = new Map<string, ProtocolEntry>();

/** Register a protocol entry. */
export function registerProtocol(entry: ProtocolEntry): void {
  if (protocolRegistry.has(entry.type)) {
    throw new Error(`Protocol entry with type "${entry.type}" already registered`);
  }
  protocolRegistry.set(entry.type, entry);
}

/** Get a protocol entry by type. */
export function protocolFor(type: string): ProtocolEntry | undefined {
  return protocolRegistry.get(type);
}

/** All registered protocol entries. */
export function getProtocols(): readonly ProtocolEntry[] {
  return [...protocolRegistry.values()];
}

/** All protocol types. */
export function protocolTypes(): readonly string[] {
  return [...protocolRegistry.keys()];
}

/** Reset protocol registry (for testing). */
export function resetProtocols(): void {
  protocolRegistry.clear();
}