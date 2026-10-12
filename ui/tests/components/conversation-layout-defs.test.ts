import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_LAYOUT_DEFS,
  CONVERSATION_LAYOUT_IDS,
  conversationLayoutDef,
  conversationLayoutIdsWhere,
} from '../../src/client/core/conversation-layout.js';

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe('conversation layout definitions (D2)', () => {
  it('derives ConversationLayoutId from the catalog keys (one source)', () => {
    expect(sorted(CONVERSATION_LAYOUT_IDS)).toEqual(
      sorted(['chronological-flow', 'semantic-map', 'artifact-map', 'source-view'])
    );
    expect(CONVERSATION_LAYOUT_IDS).toEqual(Object.keys(CONVERSATION_LAYOUT_DEFS.definition));
  });

  it('reads a definition by id with a non-empty, distinct label', () => {
    for (const id of CONVERSATION_LAYOUT_IDS) expect(conversationLayoutDef(id).label.length).toBeGreaterThan(0);
    const labels = CONVERSATION_LAYOUT_IDS.map((id) => conversationLayoutDef(id).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected layouts for each facet', () => {
    expect(sorted(conversationLayoutIdsWhere((def) => def.label === 'Chronological flow'))).toEqual(['chronological-flow']);
    expect(sorted(conversationLayoutIdsWhere((def) => def.label === 'Semantic map'))).toEqual(['semantic-map']);
    expect(sorted(conversationLayoutIdsWhere((def) => def.label === 'Artifact map'))).toEqual(['artifact-map']);
    expect(sorted(conversationLayoutIdsWhere((def) => def.label === 'Source view'))).toEqual(['source-view']);
  });

  it('every layout has a description', () => {
    for (const id of CONVERSATION_LAYOUT_IDS) {
      expect(conversationLayoutDef(id).description.length).toBeGreaterThan(0);
    }
  });

  it('catalog order matches declaration order', () => {
    expect(CONVERSATION_LAYOUT_IDS).toEqual(['chronological-flow', 'semantic-map', 'artifact-map', 'source-view']);
  });
});