/**
 * The design gate (§Move 1.5) — the qualitative checklist encoded where it can be
 * measured, so a quality regression fails a test instead of a review. What cannot
 * be measured (composition, taste) stays on `CHECKLIST.md` for a human.
 *
 * Run with: pnpm test:design
 */

import { describe, expect, it } from 'vitest';
import { THEME_NAMES, TOKENS } from '../../src/client/styles/tokens.generated.js';
import { isLegible, NODE_SIZE, nodeSize, ZOOM, zoomFloor } from '../../src/client/utils/graph-scaling.js';
import { VISUAL_CELLS } from '../visual/matrix.js';

const value = (token: string): number => Number.parseFloat(TOKENS.dark[token]);

/** The one ordered ladder a scale must be — strictly increasing, never a plateau. */
const isMonotonic = (steps: readonly number[]): boolean =>
  steps.every((step, index) => index === 0 || step > steps[index - 1]);

const TYPO_SCALE = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] as const;
const SPACING_SCALE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

describe('design: hierarchy', () => {
  it('has a strictly increasing typographic scale with enough steps to rank content', () => {
    const steps = TYPO_SCALE.map((key) => value(`typography.scale.${key}`));
    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(isMonotonic(steps)).toBe(true);
  });

  it('weights the emphasis it uses — normal < medium < semibold < bold', () => {
    const weights = ['normal', 'medium', 'semibold', 'bold'].map((key) =>
      value(`typography.fontWeights.${key}`)
    );
    expect(isMonotonic(weights)).toBe(true);
  });
});

describe('design: density', () => {
  it('has a strictly increasing spacing scale', () => {
    expect(isMonotonic(SPACING_SCALE.map((key) => value(`spacing.scale.${key}`)))).toBe(true);
  });

  it('opens a node-size window that separates important from marginal nodes', () => {
    expect(NODE_SIZE.min).toBeGreaterThan(0);
    expect(NODE_SIZE.max).toBeGreaterThan(NODE_SIZE.min);
  });
});

describe('design: focus visibility', () => {
  for (const theme of THEME_NAMES) {
    it(`theme ${theme} — the focus ring is defined and distinct from the surface`, () => {
      const tokens = TOKENS[theme];
      const ring = tokens['colors.semantic.focus-ring'];
      expect(ring).toBeTruthy();
      expect(ring).not.toBe(tokens['colors.semantic.bg-base']);
      expect(ring).not.toBe(tokens['colors.semantic.bg-panel']);
    });
  }
});

describe('design: legibility at default zoom', () => {
  it('settles a typical graph on a zoom where a typical node reads', () => {
    expect(ZOOM.min).toBeGreaterThan(0);
    const count = value('colors.legibility.reference-count');
    const area = value('colors.legibility.reference-area');
    const zoom = zoomFloor(count, area);
    expect(isLegible(nodeSize(0.5, count, area), zoom)).toBe(true);
  });
});

describe('design: paradigm visibility', () => {
  const journeys = VISUAL_CELLS.filter((cell) => cell.journey);

  it('leads with a small, led set of journey cells — not the whole wall', () => {
    expect(journeys.length).toBeGreaterThan(0);
    expect(journeys.length).toBeLessThanOrEqual(6);
  });

  it('proves the live chat⇄graph loop, streaming and tool approval', () => {
    const ids = new Set(journeys.map((cell) => cell.id));
    for (const id of ['chat-graph-context', 'chat-streaming', 'chat-tool-approval']) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('gives every journey cell a title and a group to lead with', () => {
    for (const cell of journeys) {
      expect(cell.title.length).toBeGreaterThan(0);
      expect(cell.group.length).toBeGreaterThan(0);
    }
  });
});
