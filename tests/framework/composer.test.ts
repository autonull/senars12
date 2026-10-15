/**
 * Composer tests — derived affordances from (focus, aspect).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  composer,
  focus,
  type Affordance,
  type KernelOpType,
  type FocusRef,
  type Aspect,
} from '@senars/ui/framework';

describe('composer', () => {
  const conceptFocus: FocusRef = focus.concept('cat');
  const goalFocus: FocusRef = focus.goal('mouse');
  const proposalFocus: FocusRef = focus.proposal('prop1');
  const turnFocus: FocusRef = focus.turn('turn1');
  const derivationFocus: FocusRef = focus.derivation('deriv1');

  it('returns universal affordances for any focus', () => {
    const affordances = composer(conceptFocus, 'content');
    const ids = affordances.map(a => a.id);

    // Universal: back, forward, aspect switching, depth, time
    expect(ids).toContain('focus.back');
    expect(ids).toContain('focus.forward');
    expect(ids.some(id => id.startsWith('aspect.'))).toBe(true);
    expect(ids.some(id => id.startsWith('depth.'))).toBe(true);
    expect(ids).toContain('time.live');
  });

  it('returns concept affordances for concept focus', () => {
    const affordances = composer(conceptFocus, 'content');
    const ids = affordances.map(a => a.id);

    expect(ids).toContain('concept.assert');
    expect(ids).toContain('concept.negate');
    expect(ids).toContain('concept.query');
    expect(ids).toContain('concept.revise');
    expect(ids).toContain('concept.explain');
    expect(ids).toContain('concept.pin');
  });

  it('returns goal affordances for goal focus', () => {
    const affordances = composer(goalFocus, 'content');
    const ids = affordances.map(a => a.id);

    expect(ids).toContain('goal.decompose');
    expect(ids).toContain('goal.achieve');
    expect(ids).toContain('goal.abandon');
  });

  it('returns proposal affordances for proposal focus (Dialogue Flywheel)', () => {
    const affordances = composer(proposalFocus, 'content');
    const ids = affordances.map(a => a.id);

    expect(ids).toContain('proposal.accept');
    expect(ids).toContain('proposal.correct');
    expect(ids).toContain('proposal.reject');
  });

  it('returns turn affordances for turn focus', () => {
    const affordances = composer(turnFocus, 'content');
    const ids = affordances.map(a => a.id);

    expect(ids).toContain('turn.reask');
    expect(ids).toContain('turn.correct');
  });

  it('returns derivation affordances for derivation focus', () => {
    const affordances = composer(derivationFocus, 'content');
    const ids = affordances.map(a => a.id);

    expect(ids).toContain('derivation.replay');
    expect(ids).toContain('derivation.step');
  });

  it('returns aspect-specific affordances', () => {
    // Neighborhood aspect
    const neighborhood = composer(conceptFocus, 'neighborhood');
    expect(neighborhood.map(a => a.id)).toContain('neighborhood.expand');
    expect(neighborhood.map(a => a.id)).toContain('neighborhood.layout');

    // Provenance aspect
    const provenance = composer(conceptFocus, 'provenance');
    expect(provenance.map(a => a.id)).toContain('provenance.trace');
    expect(provenance.map(a => a.id)).toContain('provenance.counterfactual');

    // Origin aspect
    const origin = composer(conceptFocus, 'origin');
    expect(origin.map(a => a.id)).toContain('origin.show-proposed');
    expect(origin.map(a => a.id)).toContain('origin.show-derived');

    // History aspect
    const history = composer(conceptFocus, 'history');
    expect(history.map(a => a.id)).toContain('history.revisions');

    // Ambient aspect
    const ambient = composer(focus.mind(), 'ambient');
    expect(ambient.map(a => a.id)).toContain('ambient.drives');
    expect(ambient.map(a => a.id)).toContain('ambient.vitals');

    // Direct aspect
    const direct = composer(conceptFocus, 'direct');
    expect(direct.map(a => a.id)).toContain('direct.configure');
  });

  it('does not include current aspect in aspect switching', () => {
    const affordances = composer(conceptFocus, 'content');
    const aspectIds = affordances.filter(a => a.id.startsWith('aspect.')).map(a => a.id);
    expect(aspectIds).not.toContain('aspect.content');
    expect(aspectIds).toContain('aspect.neighborhood');
    expect(aspectIds).toContain('aspect.provenance');
  });

  it('includes all four depth levels', () => {
    const affordances = composer(conceptFocus, 'content');
    const depthIds = affordances.filter(a => a.id.startsWith('depth.')).map(a => a.id);
    expect(depthIds).toEqual(['depth.0', 'depth.1', 'depth.2', 'depth.3']);
  });

  it('each affordance has a valid kernel op type', () => {
    const affordances = composer(conceptFocus, 'content');
    const opTypes = new Set<KernelOpType>([
      'belief.assert', 'belief.negate', 'belief.query', 'belief.revise',
      'belief.explain', 'belief.pin', 'proposal.accept', 'proposal.correct',
      'proposal.reject', 'question.answer', 'question.clarify', 'goal.decompose',
      'goal.achieve', 'goal.abandon', 'contradiction.weigh', 'contradiction.resolve',
      'turn.reask', 'turn.correct', 'focus.set', 'aspect.set', 'depth.set',
      'time.set', 'react',
    ]);

    for (const a of affordances) {
      expect(opTypes.has(a.op.type)).toBe(true);
    }
  });

  it('primary affordances are marked correctly', () => {
    const affordances = composer(conceptFocus, 'content');
    const primary = affordances.filter(a => a.kind === 'primary');
    expect(primary.length).toBeGreaterThan(0);
    expect(primary.some(a => a.id === 'concept.assert')).toBe(true);
    expect(primary.some(a => a.id === 'concept.query')).toBe(true);
    expect(primary.some(a => a.id === 'concept.explain')).toBe(true);
  });

  it('destructive affordances are marked correctly', () => {
    const affordances = composer(goalFocus, 'content');
    const destructive = affordances.filter(a => a.kind === 'destructive');
    expect(destructive.some(a => a.id === 'goal.abandon')).toBe(true);
  });

  it('shortcuts are assigned to common actions', () => {
    const affordances = composer(conceptFocus, 'content');
    const withShortcuts = affordances.filter(a => a.shortcut);
    expect(withShortcuts.some(a => a.shortcut === 'A' && a.id === 'concept.assert')).toBe(true);
    expect(withShortcuts.some(a => a.shortcut === 'Q' && a.id === 'concept.query')).toBe(true);
    expect(withShortcuts.some(a => a.shortcut === 'E' && a.id === 'concept.explain')).toBe(true);
  });

  it('handles task focus with different task types', () => {
    const beliefTask = focus.task('cat', 'belief');
    const questionTask = focus.task('cat?', 'question');
    const goalTask = focus.task('mouse!', 'goal');

    const beliefAffordances = composer(beliefTask, 'content');
    expect(beliefAffordances.map(a => a.id)).toContain('concept.assert');

    const questionAffordances = composer(questionTask, 'content');
    expect(questionAffordances.map(a => a.id)).toContain('question.answer');
    expect(questionAffordances.map(a => a.id)).toContain('question.clarify');

    const goalAffordances = composer(goalTask, 'content');
    expect(goalAffordances.map(a => a.id)).toContain('goal.decompose');
  });
});