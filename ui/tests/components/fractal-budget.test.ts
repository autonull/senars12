import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@senars/core';
import { projectChat } from '../../src/client/core/workspace-projection.js';
import { HTML_BODY_BUDGET } from '../../src/client/utils/graph-scaling.js';
import { selectHtmlLabels } from '../../src/client/utils/html-labels.js';
import {
  embedDepthExceeded,
  MAX_EMBED_DEPTH,
  renderBlockBody,
} from '../../src/client/utils/render-block.js';
import type { SemanticBlock } from '../../src/client/core/workspace-graph.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const specBlock = (): SemanticBlock => ({
  id: 'block-1',
  kind: 'claim',
  role: 'assistant',
  title: 'Claim',
  spec: {
    id: 'spec-1',
    title: 'Nested view',
    shapes: ['text'],
    source: { get: () => ({ kind: 'text', lines: ['(robin-->bird)'] }) },
  },
  createdAt: 0,
  createdBy: 'reasoner',
});

describe('embed depth budget (§Move 2.1)', () => {
  it('declares a finite nesting budget and reports when it is spent', () => {
    expect(MAX_EMBED_DEPTH).toBeGreaterThan(0);
    expect(embedDepthExceeded(0)).toBe(false);
    expect(embedDepthExceeded(MAX_EMBED_DEPTH - 1)).toBe(false);
    expect(embedDepthExceeded(MAX_EMBED_DEPTH)).toBe(true);
    expect(embedDepthExceeded(MAX_EMBED_DEPTH + 5)).toBe(true);
  });

  it('mounts a live projection within budget and a capped card beyond it', async () => {
    const live = document.createElement('div');
    render(renderBlockBody(specBlock(), [], 0), live);
    await tick();
    expect(live.querySelector('s-view')).not.toBeNull();
    expect(live.querySelector('.embed-capped')).toBeNull();

    const capped = document.createElement('div');
    render(renderBlockBody(specBlock(), [], MAX_EMBED_DEPTH), capped);
    await tick();
    expect(capped.querySelector('s-view')).toBeNull();
    expect(capped.querySelector('.embed-capped')).not.toBeNull();
  });
});

describe('the fractal rides the real projection (§Move 2.6)', () => {
  it('renders a chat-projected artifact block as an embedded view in its node body', async () => {
    const agent: ChatMessage = {
      id: 'a1',
      role: 'agent',
      content: ['| Premise | Relation |', '| --- | --- |', '| robin | bird |'].join('\n'),
      timestamp: 0,
      parentId: null,
      threadRootId: '',
      supports: [],
      contradicts: [],
      derivesFrom: [],
    };
    const table = projectChat([agent]).blocks.find((block) => block.kind === 'table');
    expect(table).toBeDefined();

    const host = document.createElement('div');
    render(renderBlockBody(table as SemanticBlock, [], 0), host);
    await tick();
    expect(host.querySelector('s-view')).not.toBeNull();
    expect(host.querySelector('.embed-capped')).toBeNull();
  });
});

describe('html body budget (§Move 2.2)', () => {
  const candidate = (id: string, importance: number, area: number) => ({ id, importance, area });

  it('caps the mounted bodies at the budget', () => {
    const candidates = Array.from({ length: HTML_BODY_BUDGET + 10 }, (_, index) =>
      candidate(`n${index}`, 0.5, 100)
    );
    expect(selectHtmlLabels(candidates, HTML_BODY_BUDGET)).toHaveLength(HTML_BODY_BUDGET);
  });

  it('keeps the most important, then the largest, then by id — deterministically', () => {
    const candidates = [
      candidate('low', 0.1, 900),
      candidate('high', 0.9, 100),
      candidate('mid', 0.5, 500),
      candidate('mid-small', 0.5, 100),
    ];
    expect(selectHtmlLabels(candidates, 3)).toEqual(['high', 'mid', 'mid-small']);
    expect(selectHtmlLabels(candidates, 3)).toEqual(selectHtmlLabels(candidates, 3));
  });

  it('never mounts a negative or fractional budget', () => {
    const candidates = [candidate('a', 0.5, 1), candidate('b', 0.4, 1)];
    expect(selectHtmlLabels(candidates, -1)).toEqual([]);
    expect(selectHtmlLabels(candidates, 1.9)).toHaveLength(1);
  });
});
