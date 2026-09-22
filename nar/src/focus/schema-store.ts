import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { recordSchemaPromotion } from '../telemetry/index.js';
import { withSpan } from '../otel/index.js';
import type { PromotedSchema } from './schema-induction.js';

/**
 * L4: persistent schema induction (unifies N2 + G1) — one sidecar store of
 * promoted schemas per (scope, action). Arcade episodes and the conversational
 * agent read/write it through the same API: the agent keeps its lessons
 * across runs.
 */
export interface StoredSchema extends PromotedSchema {
  /** Promoted at episode number (provenance). */
  episode: number;
}

export class SchemaStore {
  private readonly schemas = new Map<string, StoredSchema>();
  private episode = 0;

  /** Key = (scope, action, kind): re-promotion refreshes the entry. */
  private static key(scope: string, s: PromotedSchema): string {
    return `${scope}::${s.action}::${s.kind}`;
  }

  /** Promote one episode's induced schemas into the store. */
  promote(scope: string, schemas: readonly PromotedSchema[], episode: number): StoredSchema[] {
    this.episode = Math.max(this.episode, episode);
    const stored = schemas.map((s) => ({ ...s, episode }));
    for (const s of stored) this.schemas.set(SchemaStore.key(scope, s), s);
    if (stored.length) recordSchemaPromotion(scope, stored.length);
    return withSpan('schema_store.promote', { 'schema.scope': scope, 'schema.count': stored.length }, () => stored);
  }

  /** All schemas for a scope (action → kind + belief-grade mean reward). */
  forScope(scope: string): StoredSchema[] {
    return [...this.schemas.entries()].filter(([k]) => k.startsWith(`${scope}::`)).map(([, v]) => v);
  }

  size(): number {
    return this.schemas.size;
  }

  /** Fail-closed load: missing/corrupt sidecar ⇒ empty store (fresh agent, no lies). */
  static load(path: string): SchemaStore {
    const store = new SchemaStore();
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
        episode?: number;
        schemas?: { scope: string; schema: StoredSchema }[];
      };
      store.episode = raw.episode ?? 0;
      for (const { scope, schema } of raw.schemas ?? [])
        store.schemas.set(SchemaStore.key(scope, schema), schema);
    } catch {
      /* absent or unreadable sidecar ⇒ fresh store */
    }
    return store;
  }

  save(path: string): void {
    const payload = {
      episode: this.episode,
      schemas: [...this.schemas.entries()].map(([key, schema]) => ({
        scope: key.split('::')[0]!,
        schema,
      })),
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
