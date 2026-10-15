/**
 * Prompt perception — a submitted utterance becomes a `turn` cell that is a
 * concept with term, truth, links, provenance (§6, §16 Step 6).
 *
 * The PerceptionGate admits the raw utterance, System-1 formalizes it into
 * Narsese candidates, System-2 derives tasks, and the gates record the mutation.
 * The utterance is now a `turn` focus that IS a concept:
 *   • a term / formalization
 *   • a truth value it seeded
 *   • edges to every concept it induced
 *   • provenance (which judgment, which gate, which cycle)
 */

import { generateId } from '@senars/util';
import { type SemanticBlock, type SemanticLink, type WorkspaceGraph, type WorkspaceOp, applyWorkspaceOps, emptyWorkspaceGraph } from '../core/workspace-graph.js';
import { type FocusRef, focus, type TaskType } from './coordinates.js';
import { type FocusResolution, resolveFocus, workspaceResolver } from './resolver.js';

/** The result of perceiving a prompt. */
export interface PerceivedPrompt {
  /** The turn block created for this utterance. */
  readonly turnBlock: SemanticBlock<'turn'>;
  /** The formalized claim/concept blocks (System-1 candidates). */
  readonly formalizations: readonly SemanticBlock<'claim'>[];
  /** The admitted task blocks (System-2) — using 'answer' for beliefs, 'goal' for goals, 'question' for questions. */
  readonly tasks: readonly (SemanticBlock<'answer'> | SemanticBlock<'goal'> | SemanticBlock<'question'>)[];
  /** Links connecting the turn to its formalizations and tasks. */
  readonly links: readonly SemanticLink[];
  /** The focus reference for the turn. */
  readonly turnFocus: FocusRef;
  /** The workspace ops to apply. */
  readonly ops: readonly WorkspaceOp[];
}

/** A formalization candidate from System-1. */
export interface FormalizationCandidate {
  readonly term: string;
  readonly taskType: TaskType;
  readonly confidence: number;
  readonly sourceSpans: readonly { start: number; end: number }[];
  readonly ambiguityFlags: readonly string[];
}

/** Perceive a raw utterance and produce the turn cell with its formalizations. */
export function perceivePrompt(
  utterance: string,
  graph: WorkspaceGraph,
  formalizations: readonly FormalizationCandidate[] = []
): PerceivedPrompt {
  const turnId = generateId('turn');
  const timestamp = Date.now();

  // Create the turn block
  const turnBlock: SemanticBlock<'turn'> = {
    id: turnId,
    kind: 'turn',
    role: 'user',
    text: utterance,
    title: utterance.slice(0, 80) + (utterance.length > 80 ? '…' : ''),
    createdAt: timestamp,
    createdBy: 'user',
    status: 'complete',
    children: [],
    provenanceRefs: [],
    eventRefs: [],
    sourceRefs: [],
  };

  const ops: WorkspaceOp[] = [{ op: 'block.add', block: turnBlock }];
  const links: SemanticLink[] = [];
  const formalizationBlocks: SemanticBlock<'claim'>[] = [];
  const taskBlocks: (SemanticBlock<'answer'> | SemanticBlock<'goal'> | SemanticBlock<'question'>)[] = [];

  // Process each formalization candidate
  for (const [index, candidate] of formalizations.entries()) {
    const claimId = generateId('claim');
    const claimBlock: SemanticBlock<'claim'> = {
      id: claimId,
      kind: 'claim',
      role: 'assistant',
      text: candidate.term,
      title: candidate.term,
      createdAt: timestamp + index,
      createdBy: 'lm',
      status: 'complete',
      uncertainty: {
        frequency: 0.5 + (candidate.confidence * 0.5), // provisional truth
        confidence: candidate.confidence,
        vocabulary: 'system-1',
      },
      provenanceRefs: [turnId],
      eventRefs: [],
      sourceRefs: [],
    };
    formalizationBlocks.push(claimBlock);
    ops.push({ op: 'block.add', block: claimBlock });

    // Link turn -> formalizes -> claim
    const formalizesLink: SemanticLink = {
      id: generateId('link'),
      source: turnId,
      target: claimId,
      kind: 'formalizes',
      confidence: candidate.confidence,
      createdBy: 'lm',
    };
    links.push(formalizesLink);
    ops.push({ op: 'link.add', link: formalizesLink });

    // Add turn as parent of claim
    turnBlock.children?.push(claimId);

    // If this is a task (belief/goal/question), create a task block with the correct kind
    if (candidate.taskType !== 'belief') {
      const taskId = generateId('task');
      let taskBlock: SemanticBlock<'answer'> | SemanticBlock<'goal'> | SemanticBlock<'question'>;
      
      if (candidate.taskType === 'goal') {
        taskBlock = {
          id: taskId,
          kind: 'goal',
          role: 'assistant',
          text: candidate.term,
          title: candidate.term,
          createdAt: timestamp + index,
          createdBy: 'reasoner',
          status: 'complete',
          data: { taskType: candidate.taskType },
          provenanceRefs: [claimId],
          eventRefs: [],
          sourceRefs: [],
        };
      } else if (candidate.taskType === 'question') {
        taskBlock = {
          id: taskId,
          kind: 'question',
          role: 'assistant',
          text: candidate.term,
          title: candidate.term,
          createdAt: timestamp + index,
          createdBy: 'reasoner',
          status: 'complete',
          data: { taskType: candidate.taskType },
          provenanceRefs: [claimId],
          eventRefs: [],
          sourceRefs: [],
        };
      } else {
        // belief tasks are represented as 'answer' kind
        taskBlock = {
          id: taskId,
          kind: 'answer',
          role: 'assistant',
          text: candidate.term,
          title: candidate.term,
          createdAt: timestamp + index,
          createdBy: 'reasoner',
          status: 'complete',
          data: { taskType: candidate.taskType },
          provenanceRefs: [claimId],
          eventRefs: [],
          sourceRefs: [],
        };
      }
      
      taskBlocks.push(taskBlock);
      ops.push({ op: 'block.add', block: taskBlock });

      // Link claim -> derives -> task
      const derivesLink: SemanticLink = {
        id: generateId('link'),
        source: claimId,
        target: taskId,
        kind: 'derived-from',
        createdBy: 'reasoner',
      };
      links.push(derivesLink);
      ops.push({ op: 'link.add', link: derivesLink });
    }
  }

  // Update turn block with children
  if (turnBlock.children && turnBlock.children.length > 0) {
    ops.push({ op: 'block.patch', id: turnId, patch: { children: turnBlock.children } });
  }

  return {
    turnBlock,
    formalizations: formalizationBlocks,
    tasks: taskBlocks,
    links,
    turnFocus: focus.turn(turnId),
    ops,
  };
}

/** Apply a perceived prompt to a workspace graph. */
export function applyPerceivedPrompt(
  graph: WorkspaceGraph,
  perceived: PerceivedPrompt
): WorkspaceGraph {
  return applyWorkspaceOps(graph, perceived.ops);
}

/** Resolve a turn focus to get its content, neighborhood, provenance, history, trace. */
export function resolveTurn(
  turnFocus: FocusRef,
  graph: WorkspaceGraph
): FocusResolution {
  return workspaceResolver.resolve(turnFocus, { graph, depth: 2 });
}

/** Create a formalization candidate from a raw utterance (System-1 heuristic). */
export function heuristicFormalize(utterance: string): FormalizationCandidate[] {
  const trimmed = utterance.trim();
  const candidates: FormalizationCandidate[] = [];

  // Check for Narsese-like patterns
  if (trimmed.includes('-->') || trimmed.includes('<->') || trimmed.includes('==>') || /^[<\(].*[.?!]$/.test(trimmed)) {
    // Already Narsese
    const taskType = detectTaskType(trimmed);
    candidates.push({
      term: trimmed,
      taskType,
      confidence: 0.9,
      sourceSpans: [{ start: 0, end: trimmed.length }],
      ambiguityFlags: [],
    });
    return candidates;
  }

  // Natural language - split into sentences
  const sentences = splitSentences(trimmed);
  for (const sentence of sentences) {
    const term = naturalLanguageToNarsese(sentence);
    const taskType = detectTaskType(term);
    candidates.push({
      term,
      taskType,
      confidence: 0.7,
      sourceSpans: [{ start: 0, end: sentence.length }],
      ambiguityFlags: detectAmbiguity(sentence),
    });
  }

  return candidates;
}

/** Detect task type from Narsese term. */
function detectTaskType(term: string): TaskType {
  const t = term.trim();
  if (t.endsWith('?')) return 'question';
  if (t.endsWith('!')) return 'goal';
  return 'belief';
}

/** Split text into sentences (simple heuristic). */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Convert natural language to Narsese (placeholder for System-1 LM call). */
function naturalLanguageToNarsese(sentence: string): string {
  // This would call the LM in reality
  // For now, simple heuristic conversion
  const lower = sentence.toLowerCase().trim();
  const trimmed = sentence.trim();

  // Handle questions: "What is X?", "Who is X?" - check FIRST before "is a"
  if (lower.startsWith('what is ') || lower.startsWith('who is ')) {
    const query = trimmed.replace(/^what is |^who is /i, '').replace('?', '').trim();
    return `<${query} --> ?what>?`;
  }

  // Handle general questions ending with ?
  if (trimmed.endsWith('?')) {
    const query = trimmed.slice(0, -1).trim();
    return `<${query} --> ?what>?`;
  }

  // Handle goals ending with !
  if (trimmed.endsWith('!')) {
    const query = trimmed.slice(0, -1).trim();
    return `<${query}>!`;
  }

  // Handle "X is a Y" / "X is an Y" pattern
  if (lower.includes(' is a ') || lower.includes(' is an ')) {
    const parts = trimmed.split(/ is a | is an /i);
    if (parts.length === 2) {
      return `<${parts[0]!.trim()} --> ${parts[1]!.trim()}>.`;
    }
  }

  // Handle "X are Y" pattern
  if (lower.includes(' are ')) {
    const parts = trimmed.split(/ are /i);
    if (parts.length === 2) {
      return `<${parts[0]!.trim()} --> ${parts[1]!.trim()}>.`;
    }
  }

  return `<${trimmed}>.`;
}

/** Detect ambiguity flags in natural language. */
function detectAmbiguity(sentence: string): string[] {
  const flags: string[] = [];
  const lower = sentence.toLowerCase();

  if (/\b(not|no|never|nothing|nobody|neither)\b/i.test(sentence)) {
    flags.push('negation');
  }
  if (/\b(might|could|should|would|may|must)\b/i.test(sentence)) {
    flags.push('modal');
  }
  if (/\b(all|every|each|any|some|most|few)\b/i.test(sentence)) {
    flags.push('quantifier');
  }
  if (/\b(yesterday|tomorrow|today|now|then|before|after|when|while)\b/i.test(sentence)) {
    flags.push('temporal');
  }

  return flags;
}

/** Build the turn cell for UI rendering. */
export function turnCellFromPerceived(perceived: PerceivedPrompt): {
  turn: { focus: FocusRef; aspect: 'content'; depth: 0; expanded: true };
  formalizations: Array<{ focus: FocusRef; aspect: 'content'; depth: 1; expanded: false }>;
} {
  return {
    turn: { focus: perceived.turnFocus, aspect: 'content', depth: 0, expanded: true },
    formalizations: perceived.formalizations.map(f =>
      ({ focus: focus.concept(f.id), aspect: 'content', depth: 1, expanded: false })
    ),
  };
}