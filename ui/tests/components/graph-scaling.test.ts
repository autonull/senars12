import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  densityFactor,
  htmlLabelVisible,
  isLegible,
  labelCutoff,
  LEGIBLE_NODE_PX,
  NODE_SIZE,
  nodeSize,
  renderedNodeSize,
  showsLabel,
  ZOOM,
  zoomFloor,
} from '../../src/client/utils/graph-scaling.js';

const VIEWPORTS = {
  narrow: 360 * 640,
  desktop: 1440 * 900,
  wide: 3840 * 2160,
} as const;

const COUNTS = [1, 5, 20, 100, 1000] as const;

describe('graph scaling — node size (G.1)', () => {
  it('stays inside the token window and grows with importance', () => {
    for (const area of Object.values(VIEWPORTS)) {
      for (const count of COUNTS) {
        const low = nodeSize(0, count, area);
        const mid = nodeSize(0.5, count, area);
        const high = nodeSize(1, count, area);
        expect(low).toBeGreaterThanOrEqual(NODE_SIZE.min);
        expect(high).toBeLessThanOrEqual(NODE_SIZE.max);
        expect(low).toBeLessThanOrEqual(mid);
        expect(mid).toBeLessThanOrEqual(high);
      }
    }
  });

  it('scales up with density, bounded at both extremes', () => {
    expect(densityFactor(1000, VIEWPORTS.wide)).toBeGreaterThan(densityFactor(1, VIEWPORTS.narrow));
    expect(densityFactor(0, 0)).toBeGreaterThanOrEqual(0.6);
    expect(densityFactor(1e6, 1e9)).toBeLessThanOrEqual(2.2);
  });
});

describe('graph scaling — legible zoom window (G.2, T.4)', () => {
  it('never settles a typical node below the legible threshold', () => {
    for (const area of Object.values(VIEWPORTS)) {
      for (const count of COUNTS) {
        const zoom = zoomFloor(count, area);
        expect(zoom).toBeGreaterThanOrEqual(ZOOM.min);
        expect(zoom).toBeLessThanOrEqual(1);
        expect(isLegible(nodeSize(0.5, count, area), zoom)).toBe(true);
      }
    }
  });

  it('the floor reads at least the documented threshold', () => {
    const world = nodeSize(0.5, 12, VIEWPORTS.desktop);
    expect(renderedNodeSize(world, zoomFloor(12, VIEWPORTS.desktop))).toBeGreaterThanOrEqual(
      LEGIBLE_NODE_PX - 1e-6
    );
  });

  it('clampZoom lifts an illegible fit to the floor and caps the one-node ceiling', () => {
    const area = VIEWPORTS.desktop;
    const tiny = 0.1;
    expect(isLegible(nodeSize(0.5, 8, area), tiny)).toBe(false);
    const lifted = clampZoom(tiny, 8, area);
    expect(lifted).toBeGreaterThan(tiny);
    expect(isLegible(nodeSize(0.5, 8, area), lifted)).toBe(true);
    expect(clampZoom(99, 8, area)).toBe(ZOOM.max);
  });
});

describe('graph scaling — label level of detail (G.3)', () => {
  it('labels emerge with importance × zoom', () => {
    expect(showsLabel(1, 0.3)).toBe(true);
    expect(showsLabel(0.1, 0.3)).toBe(false);
    expect(showsLabel(0.5, 0.7)).toBe(true);
    expect(showsLabel(0.5, 0.1)).toBe(false);
  });

  it('rank-budgets the labels so a dense canvas cannot collide', () => {
    const importances = Array.from({ length: 50 }, (_, i) => i / 50);
    const cutoff = labelCutoff(importances, 1);
    const labelled = importances.filter((i) => i >= cutoff).length;
    expect(labelled).toBeGreaterThan(0);
    expect(labelled).toBeLessThanOrEqual(8);
  });

  it('labels everything when the graph is small, nothing when empty', () => {
    expect(labelCutoff([0.5, 0.6], 1)).toBeLessThanOrEqual(0.5);
    expect(labelCutoff([], 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('mounts HTML bodies only at the near tier', () => {
    expect(htmlLabelVisible(0.6)).toBe(false);
    expect(htmlLabelVisible(2)).toBe(true);
  });
});
