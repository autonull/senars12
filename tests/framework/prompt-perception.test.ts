/**
 * Prompt perception tests — a submitted utterance becomes a turn cell with
 * term, truth, links, provenance (§6).
 */

import { describe, expect, it } from 'vitest';
import {
  perceivePrompt,
  applyPerceivedPrompt,
  resolveTurn,
  heuristicFormalize,
  turnCellFromPerceived,
  type PerceivedPrompt,
  type FormalizationCandidate,
} from '@senars/ui/framework';
import {
  emptyWorkspaceGraph,
  applyWorkspaceOps,
  type WorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
} from '@senars/ui/framework';

describe('prompt perception', () => {
  let graph: WorkspaceGraph;

  beforeEach(() => {
    graph = emptyWorkspaceGraph();
  });

  it('creates a turn block from a raw utterance', () => {
    const utterance = 'Cats are mammals.';
    const perceived = perceivePrompt(utterance, graph);

    expect(perceived.turnBlock.id).toMatch(/^turn-/);
    expect(perceived.turnBlock.kind).toBe('turn');
    expect(perceived.turnBlock.role).toBe('user');
    expect(perceived.turnBlock.text).toBe(utterance);
    expect(perceived.turnBlock.createdBy).toBe('user');
  });

  it('returns a turn focus reference', () => {
    const perceived = perceivePrompt('Test.', graph);

    expect(perceived.turnFocus.kind).toBe('turn');
    expect(perceived.turnFocus.id).toBe(perceived.turnBlock.id);
  });

  it('produces workspace ops for the turn and links', () => {
    const perceived = perceivePrompt('Test.', graph);

    expect(perceived.ops.length).toBeGreaterThan(0);
    const blockOps = perceived.ops.filter(op => op.op === 'block.add');
    expect(blockOps.length).toBe(1); // Just the turn block for simple utterance
  });

  it('applies perceived prompt to graph', () => {
    const perceived = perceivePrompt('Cats are mammals.', graph);
    const newGraph = applyPerceivedPrompt(graph, perceived);

    expect(newGraph.blocks.has(perceived.turnBlock.id)).toBe(true);
    expect(newGraph.blocks.get(perceived.turnBlock.id)?.kind).toBe('turn');
  });

  it('resolves turn focus with formalizations as children', () => {
    // Create a turn with formalizations
    const formalizations: FormalizationCandidate[] = [
      {
        term: '<cat --> mammal>.',
        taskType: 'belief',
        confidence: 0.9,
        sourceSpans: [{ start: 0, end: 18 }],
        ambiguityFlags: [],
      },
    ];

    const perceived = perceivePrompt('Cats are mammals.', graph, formalizations);
    const newGraph = applyPerceivedPrompt(graph, perceived);

    const resolution = resolveTurn(perceived.turnFocus, newGraph);

    expect(resolution.content).toBeDefined();
    expect(resolution.content?.block.kind).toBe('turn');
    expect(resolution.content?.children.length).toBeGreaterThanOrEqual(1);
    const childKinds = resolution.content?.children.map(c => c.kind) ?? [];
    expect(childKinds).toContain('claim');
  });

  it('creates formalization links from turn to claims', () => {
    const formalizations: FormalizationCandidate[] = [
      {
        term: '<cat --> mammal>.',
        taskType: 'belief',
        confidence: 0.9,
        sourceSpans: [{ start: 0, end: 18 }],
        ambiguityFlags: [],
      },
    ];

    const perceived = perceivePrompt('Cats are mammals.', graph, formalizations);
    const newGraph = applyPerceivedPrompt(graph, perceived);

    const formalizesLinks = [...newGraph.links.values()].filter(
      l => l.kind === 'formalizes'
    );
    expect(formalizesLinks.length).toBe(1);
    expect(formalizesLinks[0].source).toBe(perceived.turnBlock.id);
    expect(formalizesLinks[0].target).toBe(perceived.formalizations[0].id);
  });

  it('creates task blocks for non-belief task types', () => {
    const formalizations: FormalizationCandidate[] = [
      {
        term: '<mouse --> goal>!',
        taskType: 'goal',
        confidence: 0.8,
        sourceSpans: [{ start: 0, end: 15 }],
        ambiguityFlags: [],
      },
      {
        term: '<cat --> ?what>?',
        taskType: 'question',
        confidence: 0.7,
        sourceSpans: [{ start: 0, end: 14 }],
        ambiguityFlags: [],
      },
    ];

    const perceived = perceivePrompt('Goal and question.', graph, formalizations);
    const newGraph = applyPerceivedPrompt(graph, perceived);

    // Should have turn + 2 claims + 2 tasks (goal + question)
    expect(newGraph.blocks.size).toBe(5);

    const taskBlocks = [...newGraph.blocks.values()].filter(b => b.kind === 'goal' || b.kind === 'question');
    expect(taskBlocks.length).toBe(2);

    // Check derived-from links from claims to tasks
    const derivedLinks = [...newGraph.links.values()].filter(l => l.kind === 'derived-from');
    expect(derivedLinks.length).toBe(2);
  });

  it('turnCellFromPerceived creates cells for turn and formalizations', () => {
    const formalizations: FormalizationCandidate[] = [
      {
        term: '<cat --> mammal>.',
        taskType: 'belief',
        confidence: 0.9,
        sourceSpans: [{ start: 0, end: 18 }],
        ambiguityFlags: [],
      },
    ];

    const perceived = perceivePrompt('Cats are mammals.', graph, formalizations);
    const cells = turnCellFromPerceived(perceived);

    expect(cells.turn.focus.kind).toBe('turn');
    expect(cells.turn.aspect).toBe('content');
    expect(cells.turn.depth).toBe(0);
    expect(cells.turn.expanded).toBe(true);

    expect(cells.formalizations.length).toBe(1);
    expect(cells.formalizations[0].focus.kind).toBe('concept');
    expect(cells.formalizations[0].depth).toBe(1);
    expect(cells.formalizations[0].expanded).toBe(false);
  });
});

describe('heuristicFormalize', () => {
  it('detects Narsese terms and returns them directly', () => {
    const candidates = heuristicFormalize('<cat --> mammal>.');

    expect(candidates.length).toBe(1);
    expect(candidates[0].term).toBe('<cat --> mammal>.');
    expect(candidates[0].taskType).toBe('belief');
    expect(candidates[0].confidence).toBe(0.9);
  });

  it('detects goal punctuation', () => {
    const candidates = heuristicFormalize('<cat --> mouse>!');

    expect(candidates[0].taskType).toBe('goal');
  });

  it('detects question punctuation', () => {
    const candidates = heuristicFormalize('<cat --> ?what>?');

    expect(candidates[0].taskType).toBe('question');
  });

  it('converts simple "is a" statements', () => {
    const candidates = heuristicFormalize('Cats are mammals.');

    expect(candidates.length).toBe(1);
    expect(candidates[0].term).toContain('-->');
    expect(candidates[0].taskType).toBe('belief');
  });

  it('converts "what is" questions', () => {
    const candidates = heuristicFormalize('What is a cat?');

    expect(candidates.length).toBe(1);
    expect(candidates[0].term).toContain('?what');
    expect(candidates[0].taskType).toBe('question');
  });

  it('splits multiple sentences', () => {
    const candidates = heuristicFormalize('Cats are mammals. Dogs are animals.');

    expect(candidates.length).toBe(2);
  });

  it('detects negation ambiguity', () => {
    const candidates = heuristicFormalize('Cats are not reptiles.');

    expect(candidates[0].ambiguityFlags).toContain('negation');
  });

  it('detects modal ambiguity', () => {
    const candidates = heuristicFormalize('Cats might be mammals.');

    expect(candidates[0].ambiguityFlags).toContain('modal');
  });

  it('detects quantifier ambiguity', () => {
    const candidates = heuristicFormalize('All cats are mammals.');

    expect(candidates[0].ambiguityFlags).toContain('quantifier');
  });

  it('detects temporal ambiguity', () => {
    const candidates = heuristicFormalize('Cats were mammals yesterday.');

    expect(candidates[0].ambiguityFlags).toContain('temporal');
  });
});