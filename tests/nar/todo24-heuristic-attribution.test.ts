import { describe, expect, it } from 'vitest';
import { DialogueCapture, inferReactionFromUtterance } from '@senars/nar/dialogue';
import type { ReactionKind } from '@senars/nar/dialogue';
import { InMemoryEpisodicMemory } from '../utils/in-memory-episodic.js';

/**
 * TODO24 Bench 76 — DQ2 falsifier: heuristic reaction attribution.
 * Ground-truth scripted session: each utterance's intended reaction is known.
 * Gate: precision over actually-bound pairs ≥ 0.95 AND zero false positives
 * on neutral continuations (mis-attribution poisons the flywheel, plan §9).
 * Default config ('explicit') must never bind heuristically.
 */
const capture = (attribution: 'explicit' | 'cues') =>
  new DialogueCapture({
    episodic: new InMemoryEpisodicMemory(),
    config: { enabled: true, attribution },
  });

const chat = async (cap: DialogueCapture, correlationId: string, utterance: string, response = 'ok'): Promise<string | undefined> =>
  cap.onExchange({ correlationId, utterance, response });

/** [utterance, intended kind] — ground truth scripted by the bench author. */
const GROUND_TRUTH: readonly (readonly [string, ReactionKind])[] = [
  ['that’s wrong, salt dissolves in water', 'reject'],
  ['you are completely useless today', 'reject'],
  ['actually, I meant the 4th quadrant', 'correct'],
  ['not quite — the threshold should be 0.5', 'correct'],
  ['no, that is not right at all', 'reject'],
  ['should be ascending, not descending', 'correct'],
  ['thanks, that worked', 'accept'],
  ['exactly, spot on', 'accept'],
  ['that’s right, well done', 'accept'],
  ['what do you mean by groundedness?', 'clarify'],
  ['can you explain that in Narsese?', 'clarify'],
  ['anyway, moving on to the next item', 'redirect'],
  ['let’s talk about the reflex arm instead', 'redirect'],
];

/** Normal conversational continuations — must NEVER be bound as reactions. */
const NEUTRAL: readonly string[] = [
  'and how does the manifold handle OOD inputs?',
  'continue with the derivation',
  'show me the top-ranked belief',
  'what about the budget consumption so far?',
  'now do the same for the second example',
  'compare that with the baseline',
  'run three more cycles',
  'why did the gate abstain there?',
];

describe('TODO24 Bench 76 — Heuristic reaction attribution (DQ2)', () => {
  it('cue inference: precision ≥ 0.95 against scripted ground truth', () => {
    let bound = 0;
    let correct = 0;
    for (const [utterance, intended] of GROUND_TRUTH) {
      const inferred = inferReactionFromUtterance(utterance);
      if (inferred) {
        bound++;
        if (inferred === intended) correct++;
      }
    }
    expect(bound).toBeGreaterThanOrEqual(10); // high recall on cue-laden text
    expect(correct / bound).toBeGreaterThanOrEqual(0.95);
  });

  it('zero false positives: neutral continuations never infer a reaction', () => {
    for (const utterance of NEUTRAL) {
      expect(inferReactionFromUtterance(utterance)).toBeUndefined();
    }
  });

  it('end-to-end: cued attribution binds the previous turn; neutral messages do not', async () => {
    const cap = capture('cues');
    const t1 = await chat(cap, 'corr-a', 'what dissolves salt?', 'salt dissolves in oil');
    await chat(cap, 'corr-a', 'actually, I meant water, not oil');
    const t2 = await chat(cap, 'corr-a', 'and how does the manifold handle OOD?', 'via the OOD head');
    const t3 = await chat(cap, 'corr-a', 'thanks, that clarified it');
    const t4 = await chat(cap, 'corr-a', 'tell me about episodic memory instead', 'it is append-only');

    expect(cap.getTurn(t1!)!.reaction?.kind).toBe('correct'); // cued by turn 2's utterance
    expect(cap.getTurn(t2!)!.reaction?.kind).toBe('accept'); // "thanks" reacts to the OOD answer
    expect(cap.getTurn(t3!)!.reaction).toBeUndefined(); // "instead" alone is too weak to cue
    expect(cap.getTurn(t4!)!.reaction).toBeUndefined(); // last turn, nothing follows yet
  });

  it('default attribution is explicit — heuristic never fires without opt-in', async () => {
    const cap = capture('explicit');
    const t1 = await chat(cap, 'corr-b', 'what dissolves salt?', 'salt dissolves in oil');
    await chat(cap, 'corr-b', 'actually, I meant water, not oil');
    expect(cap.getTurn(t1!)!.reaction).toBeUndefined();
  });

  it('explicit .react binding wins over a later cued inference (no double-bind)', async () => {
    const cap = capture('cues');
    const t1 = await chat(cap, 'corr-c', 'q', 'a');
    await cap.bindReaction(t1!, 'accept');
    await chat(cap, 'corr-c', 'actually, forget the last part');
    expect(cap.getTurn(t1!)!.reaction?.kind).toBe('accept');
  });
});
