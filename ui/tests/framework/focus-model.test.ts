import { describe, expect, it, vi } from 'vitest';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
} from '../../src/client/core/workspace-graph.js';
import { blockToFocusRef } from '../../src/client/kernel/state.js';
import {
  ASPECTS,
  atTime,
  cellFor,
  cellKey,
  clampDepth,
  DEFAULT_ASPECT,
  FOCUS_KINDS,
  focus,
  focusKey,
  focusRefId,
  isAspect,
  isFocusKind,
  LIVE,
  MIND_FOCUS,
  timeKey,
  timeRange,
  FOCUS_FRAGMENT_PREFIX,
  encodeFocusFragment,
  decodeFocusFragment,
} from '../../src/client/framework/coordinates.js';
import { createFocusStack } from '../../src/client/framework/focus-stack.js';
import { aspectSlice, hasSlice, resolveFocus } from '../../src/client/framework/resolver.js';

const block = (id: string, patch: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...patch,
});

const link = (
  id: string,
  source: string,
  target: string,
  kind: SemanticLink['kind']
): SemanticLink => ({ id, source, target, kind, createdBy: 'lm' });

const graph = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('focus', { kind: 'turn', children: ['child'] }) },
    { op: 'block.add', block: block('child', { createdAt: 1 }) },
    { op: 'block.add', block: block('peer') },
    { op: 'block.add', block: block('support') },
    { op: 'block.add', block: block('old', { createdAt: 5 }) },
    { op: 'block.add', block: block('newer', { createdAt: 9 }) },
    { op: 'block.add', block: block('event') },
    { op: 'block.add', block: block('gate') },
    { op: 'link.add', link: link('l-neighbor', 'focus', 'peer', 'references') },
    { op: 'link.add', link: link('l-support', 'support', 'focus', 'supports') },
    { op: 'link.add', link: link('l-old', 'old', 'focus', 'revises') },
    { op: 'link.add', link: link('l-newer', 'newer', 'focus', 'revises') },
    { op: 'link.add', link: link('l-gate', 'focus', 'gate', 'admitted-by-gate') },
  ]);

describe('the four coordinates', () => {
  it('keys every focus kind uniquely and stably', () => {
    const keys = [
      focus.concept('cat'),
      focus.task('cat', 'goal'),
      focus.goal('cat'),
      focus.step('d1', 2),
      focus.time(atTime(5)),
      focus.drive('curiosity'),
      MIND_FOCUS,
    ].map(focusKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(focusKey(focus.concept('cat'))).toBe('concept:cat');
    expect(focusKey(focus.task('cat', 'goal'))).toBe('task:goal:cat');
    expect(focusKey(focus.step('d1', 2))).toBe('step:d1#2');
    expect(focusKey(MIND_FOCUS)).toBe('mind');
  });

  it('addresses terms by term and records by id', () => {
    expect(focusRefId(focus.concept('cat'))).toBe('cat');
    expect(focusRefId(focus.task('cat'))).toBe('cat');
    expect(focusRefId(focus.derivation('d1'))).toBe('d1');
    expect(focusRefId(focus.step('d1', 3))).toBe('d1');
    expect(focusRefId(focus.turn('t1'))).toBe('t1');
    expect(focusRefId(MIND_FOCUS)).toBeUndefined();
    expect(focusRefId(focus.time(LIVE))).toBeUndefined();
  });

  it('distinguishes temporal coordinates', () => {
    expect(timeKey(LIVE)).toBe('live');
    expect(timeKey(atTime(7))).toBe('at:7');
  });

  it('guards kinds and aspects against the whole vocabulary', () => {
    expect(FOCUS_KINDS.every(isFocusKind)).toBe(true);
    expect(isFocusKind('blob')).toBe(false);
    expect(ASPECTS.every(isAspect)).toBe(true);
    expect(isAspect('mode')).toBe(false);
  });

  it('clamps depth to the ladder and builds cells from defaults', () => {
    expect(clampDepth(9)).toBe(3);
    expect(clampDepth(-4)).toBe(0);
    expect(clampDepth(1.6)).toBe(2);
    const cell = cellFor(focus.concept('cat'), { aspect: 'neighborhood', depth: 5 });
    expect(cell).toEqual({
      focus: focus.concept('cat'),
      aspect: 'neighborhood',
      depth: 3,
      time: LIVE,
      expanded: false,
    });
    expect(cellFor(focus.concept('cat')).aspect).toBe(DEFAULT_ASPECT);
    expect(cellKey(cell)).toBe('concept:cat|neighborhood|3|live');
    expect(cellKey(cellFor(focus.concept('cat')))).not.toBe(cellKey(cell));
  });
});

describe('the focus stack', () => {
  it('is reversible', () => {
    const stack = createFocusStack();
    expect(stack.current()).toEqual(MIND_FOCUS);
    stack.set(focus.concept('cat'));
    stack.set(focus.turn('t1'));
    expect(stack.canGoBack()).toBe(true);
    expect(stack.back()).toEqual(focus.concept('cat'));
    expect(stack.canGoForward()).toBe(true);
    expect(stack.forward()).toEqual(focus.turn('t1'));
    expect(stack.canGoForward()).toBe(false);
  });

  it('does not record a visit to the same subject', () => {
    const stack = createFocusStack();
    stack.set(focus.concept('cat'));
    stack.set(focus.concept('cat'));
    expect(stack.history()).toHaveLength(1);
  });

  it('replace and reset move without history', () => {
    const stack = createFocusStack(focus.concept('cat'));
    stack.replace(focus.concept('dog'));
    expect(stack.current()).toEqual(focus.concept('dog'));
    expect(stack.canGoBack()).toBe(false);
    stack.set(focus.turn('t1'));
    stack.reset();
    expect(stack.current()).toEqual(MIND_FOCUS);
    expect(stack.canGoBack()).toBe(false);
  });

  it('bounds history and notifies subscribers', () => {
    const stack = createFocusStack(undefined, 2);
    const seen = vi.fn();
    const off = stack.subscribe(seen);
    for (const id of ['a', 'b', 'c', 'd']) stack.set(focus.turn(id));
    expect(stack.history()).toHaveLength(2);
    expect(seen).toHaveBeenCalledTimes(4);
    off();
  });
});

describe('the resolver', () => {
  it('resolves a block into its slices', () => {
    const resolution = resolveFocus(focus.turn('focus'), { graph: graph() });
    expect(resolution.content?.block.id).toBe('focus');
    expect(resolution.content?.children.map((b) => b.id)).toEqual(['child']);
    expect(resolution.neighborhood?.neighbors.map((n) => n.block.id)).toContain('peer');
    expect(resolution.provenance?.records.map((b) => b.id)).toEqual(['support']);
    expect(resolution.history?.revisions.map((b) => b.id)).toEqual(['old', 'newer']);
    expect(resolution.trace?.events.map((b) => b.id)).toEqual(['gate']);
  });

  it('resolves an unknown or non-block focus to no slices', () => {
    expect(resolveFocus(focus.turn('ghost'), { graph: graph() })).toEqual({
      ref: focus.turn('ghost'),
    });
    expect(resolveFocus(MIND_FOCUS, { graph: graph() })).toEqual({ ref: MIND_FOCUS });
    expect(resolveFocus(focus.time(LIVE), { graph: graph() })).toEqual({ ref: focus.time(LIVE) });
  });

  it('projects an aspect onto its slice', () => {
    const resolution = resolveFocus(focus.turn('focus'), { graph: graph() });
    expect(aspectSlice(resolution, 'content')).toBe(resolution.content);
    expect(aspectSlice(resolution, 'history')).toBe(resolution.history);
    expect(hasSlice(resolution, 'neighborhood')).toBe(true);
    expect(hasSlice(resolution, 'ambient')).toBe(false);
  });

  it('resolves formalization containment (turn → formalizes claim)', () => {
    const g = applyWorkspaceOps(emptyWorkspaceGraph(), [
      { op: 'block.add', block: block('turn1', { kind: 'turn', children: ['claim1'] }) },
      { op: 'block.add', block: block('claim1', { kind: 'claim' }) },
      { op: 'link.add', link: link('l1', 'turn1', 'claim1', 'formalizes') },
    ]);
    const resolution = resolveFocus(focus.turn('turn1'), { graph: g });
    expect(resolution.content?.children.map((b) => b.id)).toContain('claim1');
  });

  it('resolves goal subgoal containment (goal → achieves subgoal)', () => {
    const g = applyWorkspaceOps(emptyWorkspaceGraph(), [
      { op: 'block.add', block: block('goal1', { kind: 'goal', children: ['subgoal1'] }) },
      { op: 'block.add', block: block('subgoal1', { kind: 'goal' }) },
      { op: 'link.add', link: link('l1', 'goal1', 'subgoal1', 'achieves') },
    ]);
    const resolution = resolveFocus(focus.goal('goal1'), { graph: g });
    expect(resolution.content?.children.map((b) => b.id)).toContain('subgoal1');
  });
});

describe('blockToFocusRef maps every BlockKind to a FocusRef', () => {
  const b = (id: string, kind: SemanticBlock['kind'], patch: Partial<SemanticBlock> = {}): SemanticBlock =>
    block(id, { kind, ...patch });

  it('maps conversation/structural kinds', () => {
    expect(blockToFocusRef(b('t1', 'turn'))).toEqual(focus.turn('t1'));
    expect(blockToFocusRef(b('s1', 'section')).kind).toBe('concept');
    expect(blockToFocusRef(b('h1', 'heading')).kind).toBe('concept');
    expect(blockToFocusRef(b('p1', 'paragraph')).kind).toBe('concept');
    expect(blockToFocusRef(b('l1', 'list')).kind).toBe('concept');
    expect(blockToFocusRef(b('r1', 'raw')).kind).toBe('concept');
  });

  it('maps epistemic kinds', () => {
    expect(blockToFocusRef(b('c1', 'claim')).kind).toBe('concept');
    expect(blockToFocusRef(b('g1', 'goal'))).toEqual(focus.goal('g1'));
    expect(blockToFocusRef(b('q1', 'question'))).toEqual(focus.task('q1', 'question'));
    expect(blockToFocusRef(b('a1', 'answer'))).toEqual(focus.task('a1', 'belief'));
  });

  it('maps derivation kinds', () => {
    expect(blockToFocusRef(b('d1', 'derivation'))).toEqual(focus.derivation('d1'));
    expect(blockToFocusRef(b('dr1', 'derivation-record'))).toEqual(focus.step('dr1', 0));
  });

  it('maps judgment/gate kinds', () => {
    expect(blockToFocusRef(b('gd1', 'gate-decision'))).toEqual(focus.judgment('gd1'));
  });

  it('maps artifact kinds', () => {
    expect(blockToFocusRef(b('t1', 'table')).kind).toBe('concept');
    expect(blockToFocusRef(b('c1', 'code')).kind).toBe('concept');
    expect(blockToFocusRef(b('m1', 'math')).kind).toBe('concept');
    expect(blockToFocusRef(b('i1', 'image')).kind).toBe('concept');
    expect(blockToFocusRef(b('d1', 'diagram')).kind).toBe('concept');
    expect(blockToFocusRef(b('ch1', 'chart')).kind).toBe('concept');
    expect(blockToFocusRef(b('ci1', 'citation')).kind).toBe('concept');
  });

  it('maps tool interaction kinds', () => {
    expect(blockToFocusRef(b('tc1', 'tool-call'))).toEqual(focus.event('tc1'));
    expect(blockToFocusRef(b('tr1', 'tool-result'))).toEqual(focus.event('tr1'));
  });

  it('maps system event kinds', () => {
    expect(blockToFocusRef(b('cc1', 'config-change'))).toEqual(focus.event('cc1'));
    expect(blockToFocusRef(b('cmd1', 'command'))).toEqual(focus.event('cmd1'));
    expect(blockToFocusRef(b('e1', 'error'))).toEqual(focus.event('e1'));
    expect(blockToFocusRef(b('b1', 'budget'))).toEqual(focus.event('b1'));
  });
});

describe('focusKey URL/fragment encoding', () => {
  it('encodes and decodes a concept cell round-trip', () => {
    const cell = cellFor(focus.concept('cat'), { aspect: 'neighborhood', depth: 2 });
    const fragment = encodeFocusFragment(cell);
    expect(fragment).toBe('focus=concept:cat|neighborhood|2|live');
    const decoded = decodeFocusFragment(fragment);
    expect(decoded).not.toBeNull();
    expect(decoded!.focus).toEqual(focus.concept('cat'));
    expect(decoded!.aspect).toBe('neighborhood');
    expect(decoded!.depth).toBe(2);
    expect(decoded!.time).toEqual(LIVE);
  });

  it('encodes and decodes a task cell with time range', () => {
    const time = timeRange(100, 200);
    const cell = cellFor(focus.task('goal-1', 'goal'), { aspect: 'provenance', depth: 1, time });
    const fragment = encodeFocusFragment(cell);
    expect(fragment).toContain('focus=task:goal:goal-1|provenance|1|range:100-200');
    const decoded = decodeFocusFragment(fragment);
    expect(decoded).not.toBeNull();
    expect(decoded!.focus).toEqual(focus.task('goal-1', 'goal'));
    expect(decoded!.aspect).toBe('provenance');
    expect(decoded!.depth).toBe(1);
    expect(decoded!.time).toEqual(time);
  });

  it('encodes and decodes the mind focus', () => {
    const cell = cellFor(MIND_FOCUS, { aspect: 'ambient' });
    const fragment = encodeFocusFragment(cell);
    expect(fragment).toBe('focus=mind|ambient|0|live');
    const decoded = decodeFocusFragment(fragment);
    expect(decoded).not.toBeNull();
    expect(decoded!.focus).toEqual(MIND_FOCUS);
    expect(decoded!.aspect).toBe('ambient');
  });

  it('returns null for invalid fragments', () => {
    expect(decodeFocusFragment('invalid')).toBeNull();
    expect(decodeFocusFragment('focus=invalid')).toBeNull();
    expect(decodeFocusFragment('focus=concept:cat|neighborhood')).toBeNull();
    expect(decodeFocusFragment('focus=unknown:cat|content|0|live')).toBeNull();
  });

  it('handles step focus with derivation index', () => {
    const cell = cellFor(focus.step('deriv-1', 3), { aspect: 'provenance', depth: 2 });
    const fragment = encodeFocusFragment(cell);
    expect(fragment).toBe('focus=step:deriv-1#3|provenance|2|live');
    const decoded = decodeFocusFragment(fragment);
    expect(decoded).not.toBeNull();
    expect(decoded!.focus).toEqual(focus.step('deriv-1', 3));
  });
});
