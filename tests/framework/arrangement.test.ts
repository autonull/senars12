/**
 * Arrangement strategy tests.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  linearStrategy,
  outlineStrategy,
  spatialStrategy,
  gridStrategy,
  mixedStrategy,
  registerBuiltinArrangements,
  getArrangementStrategy,
  getArrangementKinds,
  defaultStrategyFor,
} from '@senars/ui/framework/arrangement-strategies';
import {
  registerArrangement,
  arrangeCell,
  getArrangementStrategy as getArrStrategy,
  getArrangementKinds as getArrKinds,
} from '@senars/ui/framework/arrangement';
import {
  cellFor,
  focus,
  type FocusCell,
  type ArrangedCell,
  type ArrangementGlobals,
} from '@senars/ui/framework/coordinates';

const viewport = { width: 800, height: 600 };
const globals: ArrangementGlobals = {};

const createCells = (count: number): FocusCell[] =>
  Array.from({ length: count }, (_, i) =>
    cellFor(focus.concept(`concept${i}`), { aspect: 'content', depth: 0 })
  );

const createArrangedCells = (count: number): ArrangedCell[] =>
  Array.from({ length: count }, (_, i) =>
    arrangeCell(cellFor(focus.concept(`concept${i}`), { aspect: 'content', depth: 0 }))
  );

describe('arrangement registry', () => {
  beforeEach(() => {
    // Reset by re-registering builtins
    registerBuiltinArrangements();
  });

  it('registers all five built-in strategies', () => {
    const kinds = getArrKinds();
    expect(kinds).toEqual(['linear', 'outline', 'spatial', 'grid', 'mixed']);
    expect(kinds.length).toBe(5);
  });

  it('retrieves each strategy by kind', () => {
    expect(getArrStrategy('linear')?.label).toBe('Linear');
    expect(getArrStrategy('outline')?.label).toBe('Outline');
    expect(getArrStrategy('spatial')?.label).toBe('Spatial');
    expect(getArrStrategy('grid')?.label).toBe('Grid');
    expect(getArrStrategy('mixed')?.label).toBe('Mixed');
  });
});

describe('linear strategy', () => {
  it('lays out cells in a single column', () => {
    const cells = createArrangedCells(3);
    const result = linearStrategy.layout(cells, globals, viewport);

    expect(result.columns).toBe('1fr');
    expect(result.rows).toBe('repeat(3, auto)');
    expect(result.cellAreas.size).toBe(3);
    expect(result.cellStyles.size).toBe(3);
  });

  it('handles empty cell set', () => {
    const result = linearStrategy.layout([], globals, viewport);
    expect(result.columns).toBe('1fr');
    expect(result.rows).toBe('1fr');
    expect(result.areas).toBe('"empty"');
  });

  it('assigns sequential grid rows', () => {
    const cells = createArrangedCells(4);
    const result = linearStrategy.layout(cells, globals, viewport);

    const styles = Array.from(result.cellStyles.values());
    expect(styles[0].gridRow).toBe('1');
    expect(styles[1].gridRow).toBe('2');
    expect(styles[2].gridRow).toBe('3');
    expect(styles[3].gridRow).toBe('4');
  });
});

describe('outline strategy', () => {
  it('flattens a tree with indentation', () => {
    const parent = arrangeCell(cellFor(focus.concept('parent'), { aspect: 'content', depth: 0 }), {
      isContainer: true,
      children: ['child1', 'child2'],
    });
    const child1 = arrangeCell(cellFor(focus.concept('child1'), { aspect: 'content', depth: 1 }));
    const child2 = arrangeCell(cellFor(focus.concept('child2'), { aspect: 'content', depth: 1 }));

    const cells: ArrangedCell[] = [parent, child1, child2];
    const result = outlineStrategy.layout(cells, globals, viewport);

    expect(result.cellAreas.size).toBe(3);
    expect(result.rows).toBe('repeat(3, auto)');
  });

  it('handles cells without containment', () => {
    const cells = createArrangedCells(3);
    const result = outlineStrategy.layout(cells, globals, viewport);

    expect(result.cellAreas.size).toBe(3);
  });
});

describe('spatial strategy', () => {
  it('positions cells absolutely', () => {
    const cells = createArrangedCells(3).map((c, i) =>
      arrangeCell(c, { position: { x: i * 0.2, y: i * 0.2 } })
    );
    const result = spatialStrategy.layout(cells, globals, viewport);

    expect(result.columns).toBe('1fr');
    expect(result.rows).toBe('1fr');
    expect(result.cellStyles.size).toBe(3);

    const style = result.cellStyles.get('concept:concept0|content|0|live');
    expect(style?.position).toBe('absolute');
    expect(style?.left).toBe('0%');
    expect(style?.top).toBe('0%');
  });

  it('defaults to center when no position given', () => {
    const cells = createArrangedCells(1);
    const result = spatialStrategy.layout(cells, globals, viewport);

    const style = result.cellStyles.get('concept:concept0|content|0|live');
    expect(style?.left).toBe('50%');
    expect(style?.top).toBe('50%');
  });
});

describe('grid strategy', () => {
  it('arranges cells in a square-ish grid', () => {
    const cells = createArrangedCells(4);
    const result = gridStrategy.layout(cells, globals, viewport);

    expect(result.columns).toBe('repeat(2, 1fr)');
    expect(result.rows).toBe('repeat(2, 1fr)');
    expect(result.cellAreas.size).toBe(4);
  });

  it('handles non-square cell counts', () => {
    const cells = createArrangedCells(5);
    const result = gridStrategy.layout(cells, globals, viewport);

    // 3 cols, 2 rows
    expect(result.columns).toBe('repeat(3, 1fr)');
    expect(result.rows).toBe('repeat(2, 1fr)');
  });

  it('assigns correct grid-column/row to each cell', () => {
    const cells = createArrangedCells(4);
    const result = gridStrategy.layout(cells, globals, viewport);

    const styles = Array.from(result.cellStyles.values());
    expect(styles[0].gridColumn).toBe('1');
    expect(styles[0].gridRow).toBe('1');
    expect(styles[1].gridColumn).toBe('2');
    expect(styles[1].gridRow).toBe('1');
    expect(styles[2].gridColumn).toBe('1');
    expect(styles[2].gridRow).toBe('2');
    expect(styles[3].gridColumn).toBe('2');
    expect(styles[3].gridRow).toBe('2');
  });
});

describe('mixed strategy', () => {
  it('groups spatial cells separately from linear cells', () => {
    const spatialCell = arrangeCell(cellFor(focus.concept('spatial'), { aspect: 'content', depth: 0 }), {
      position: { x: 0.5, y: 0.5 },
    });
    const linearCells = createArrangedCells(2);

    const cells: ArrangedCell[] = [spatialCell, ...linearCells];
    const result = mixedStrategy.layout(cells, globals, viewport);

    expect(result.cellAreas.size).toBe(3);
    const spatialStyle = result.cellStyles.get('concept:spatial|content|0|live');
    expect(spatialStyle?.position).toBe('absolute');
  });
});

describe('defaultStrategyFor', () => {
  it('returns spatial for neighborhood aspect', () => {
    expect(defaultStrategyFor('neighborhood', 0)).toBe('spatial');
    expect(defaultStrategyFor('neighborhood', 2)).toBe('spatial');
  });

  it('returns linear for content at depth 0', () => {
    expect(defaultStrategyFor('content', 0)).toBe('linear');
  });

  it('returns outline for content at depth > 0', () => {
    expect(defaultStrategyFor('content', 1)).toBe('outline');
    expect(defaultStrategyFor('content', 3)).toBe('outline');
  });

  it('returns appropriate strategies for other aspects', () => {
    expect(defaultStrategyFor('provenance', 0)).toBe('outline');
    expect(defaultStrategyFor('history', 0)).toBe('linear');
    expect(defaultStrategyFor('ambient', 0)).toBe('spatial');
    expect(defaultStrategyFor('direct', 0)).toBe('grid');
    expect(defaultStrategyFor('origin', 0)).toBe('mixed');
  });
});