import { describe, expect, it, vi } from 'vitest';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
} from '../../src/client/core/workspace-graph.js';
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
