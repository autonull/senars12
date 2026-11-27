/**
 * Episodic Fold — log replay and projection building.
 */

import { BoundedRing, getOrInsert, selectTopN, sortBy } from '@senars/util/collections';
import { nextInt, type RandomSource } from '@senars/util/random';
import type { BeliefTruth } from '@senars/types/truth';
import { LINK, PRESSURE } from '../../constants';
import { NullAttentionModel } from '../../strategies/attention/NullAttentionModel';
import type { AttentionModel } from '../../strategies/types';
import {
  Stamp,
  type Term,
  TermMap,
  type TermMapEntry,
  TermSet,
  Truth,
  termKey,
} from '../../terms';
import { atom } from '../../terms/impls/factory';
import type { Budget, Task } from '../../types';
import { NEUTRAL_BUDGET } from '../../types';
import { AssociativeRegistry, GraphMemory } from '../associative';
import type { ConceptGraph } from '../ConceptGraph';
import {
  Concept,
  type ConceptMergeResult,
  type ConceptTaskType,
  taskFromBagItem,
  type TaskData,
} from '../concept';
import { DEFAULT_MEMORY_CONFIG, type MemoryConfig, type ResolvedMemoryConfig } from '../config';
import { type EmbeddingGenerator, MockEmbeddingGenerator } from '../embedding';
import { Focus } from '../focus';
import type { MemoryHealth } from '../health';
import { Archive, Forgetting } from '../lifecycle';
import { LinkManager } from '../links/LinkManager';
import { EmbeddingLayer } from '../links/EmbeddingLayer';
import { LINK_LAYER } from '../links/types';
import { MemoryIndex } from '../memory-index';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from '../ports/index';
import type { EvictionReport } from '../pressure';
import { evictUnderPressure } from '../pressure';
import { selectSimilar } from '../similarity';
import { calculateConceptStats, storePressure, tallyConcepts } from '../state';
import { filterByTerm } from '../term-filter';
import { EpisodicMemory } from '../EpisodicMemory';
import type { Episode, EpisodeType } from '@senars/types/episodic-memory';
import { EPISODE_TYPES } from '@senars/types/episodic-memory';
import { ConceptConfig } from '../concept';
import type { Belief, Question, MemoryStats } from '../view';

/** Stateless, so one instance serves every memory that was not given a model. */
const NULL_ATTENTION = new NullAttentionModel();

/** Episode type for concept/task operations in the log metadata. */
const FOLD_OP_TYPES = [
  'concept_added',
  'task_admitted',
  'concept_removed',
  'concept_archived',
  'link_added',
  'link_removed',
  'revision_recorded',
  'consolidation_run',
  'eviction_run',
] as const;

type FoldOpType = (typeof FOLD_OP_TYPES)[number];

/** Extended episode with fold operation payload in metadata. */
interface FoldEpisode extends Episode {
  metadata: Episode['metadata'] & {
    foldOp?: FoldOpType;
    conceptTerm?: string;
    taskType?: ConceptTaskType;
    truth?: Truth;
    budget?: Budget;
    stamp?: Stamp;
    linkSource?: string;
    linkTarget?: string;
    linkLayer?: string;
    linkPriority?: number;
    revisionTermKey?: string;
    revisionTruth?: BeliefTruth;
    revisionStampId?: string;
    consolidationCycles?: number;
    evictionReason?: string;
  };
}

/** Concept projection derived from the log. */
export interface ConceptProjection {
  concept: Concept;
  lastSeen: number;
  isArchived: boolean;
}

/** Task projection derived from the log. */
export interface TaskProjection {
  conceptTerm: string;
  task: TaskData;
  admittedAt: number;
}

/** Link projection derived from the log. */
interface LinkProjection {
  source: string;
  target: string;
  layer: string;
  priority: number;
  lastUpdated: number;
}

/** Revision projection derived from the log. */
interface RevisionProjection {
  termKey: string;
  truth: BeliefTruth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

/** Archive projection derived from the log. */
interface ArchiveProjection {
  conceptTerm: string;
  archivedAt: number;
  reason: string;
}

/** Build initial projections from episodes. */
export function buildProjectionsFromLog(
  episodes: Episode[],
  config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator }
): {
  concepts: Map<string, ConceptProjection>;
  tasks: Map<string, TaskProjection[]>;
  links: Map<string, LinkProjection[]>;
  revisions: RevisionProjection[];
  archiveLog: ArchiveProjection[];
} {
  const concepts = new Map<string, ConceptProjection>();
  const tasks = new Map<string, TaskProjection[]>();
  const links = new Map<string, LinkProjection[]>();
  const revisions: RevisionProjection[] = [];
  const archiveLog: ArchiveProjection[] = [];

  // Sort by timestamp to replay in order
  const sorted = [...episodes].sort((a, b) => a.timestamp - b.timestamp);

  for (const ep of sorted) {
    applyEpisode(ep, concepts, tasks, links, revisions, archiveLog, config);
  }

  return { concepts, tasks, links, revisions, archiveLog };
}

/** Apply a single episode to projections. */
function applyEpisode(
  ep: Episode,
  concepts: Map<string, ConceptProjection>,
  tasks: Map<string, TaskProjection[]>,
  links: Map<string, LinkProjection[]>,
  revisions: RevisionProjection[],
  archiveLog: ArchiveProjection[],
  _config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator }
): void {
  const meta = ep.metadata as FoldEpisode['metadata'];

  // Check for fold operations in metadata
  if (meta.foldOp) {
    switch (meta.foldOp) {
      case 'concept_added': {
        if (meta.conceptTerm) {
          // Concept would be created here - skip for projection rebuild
        }
        break;
      }
      case 'task_admitted': {
        if (meta.conceptTerm && meta.taskType) {
          const conceptTasks = getOrInsert(tasks, meta.conceptTerm, () => []);
          const term = atom(meta.conceptTerm);
          conceptTasks.push({
            conceptTerm: meta.conceptTerm,
            task: {
              id: meta.stamp?.id ?? `task-${meta.timestamp}`,
              term,
              priority: meta.budget?.priority ?? 0,
              truth: meta.truth ?? Truth.NEUTRAL,
              budget: meta.budget ?? NEUTRAL_BUDGET,
              stamp: meta.stamp ?? Stamp.createInput(),
              createdAt: ep.timestamp,
            } as TaskData,
            admittedAt: ep.timestamp,
          });
        }
        break;
      }
      case 'concept_removed': {
        if (meta.conceptTerm) {
          concepts.delete(meta.conceptTerm);
          tasks.delete(meta.conceptTerm);
        }
        break;
      }
      case 'concept_archived': {
        if (meta.conceptTerm) {
          const existing = concepts.get(meta.conceptTerm);
          if (existing) {
            existing.isArchived = true;
          }
          archiveLog.push({
            conceptTerm: meta.conceptTerm,
            archivedAt: ep.timestamp,
            reason: 'log_append',
          });
        }
        break;
      }
      case 'link_added': {
        if (meta.linkSource && meta.linkTarget && meta.linkLayer) {
          const layerLinks = getOrInsert(links, meta.linkLayer, () => []);
          layerLinks.push({
            source: meta.linkSource,
            target: meta.linkTarget,
            layer: meta.linkLayer,
            priority: meta.linkPriority ?? 1.0,
            lastUpdated: ep.timestamp,
          });
        }
        break;
      }
      case 'link_removed': {
        if (meta.linkSource && meta.linkTarget && meta.linkLayer) {
          const layerLinks = links.get(meta.linkLayer);
          if (layerLinks) {
            const idx = layerLinks.findIndex(
              (l) => l.source === meta.linkSource && l.target === meta.linkTarget
            );
            if (idx >= 0) layerLinks.splice(idx, 1);
          }
        }
        break;
      }
      case 'revision_recorded': {
        if (meta.revisionTermKey && meta.revisionTruth) {
          revisions.push({
            termKey: meta.revisionTermKey,
            truth: meta.revisionTruth,
            stampId: meta.revisionStampId ?? '',
            timestamp: ep.timestamp,
            source: (meta.source ?? 'input') as 'input' | 'derivation' | 'revision' | 'inference',
          });
          if (revisions.length > 1000) {
            revisions.shift();
          }
        }
        break;
      }
      case 'consolidation_run':
      case 'eviction_run':
        break;
    }
  }
}

/** Create a FoldEpisode append function. */
export function createFoldAppender(log: EpisodicMemory) {
  return (foldOp: FoldOpType, payload: FoldEpisode['metadata']): Promise<void> =>
    log.log('belief_added' as EpisodeType, `fold:${foldOp}`, {
      ...payload,
      foldOp,
    });
}

/** Log a concept addition. */
export function logConceptAdded(log: EpisodicMemory, term: Term): () => Promise<void> {
  return () => createFoldAppender(log)('concept_added', { conceptTerm: termKey(term) });
}

/** Log a task admission. */
export function logTaskAdmitted(
  log: EpisodicMemory,
  term: Term,
  type: ConceptTaskType,
  truth?: Truth,
  budget?: Budget,
  stamp?: Stamp
): () => Promise<void> {
  return () =>
    createFoldAppender(log)('task_admitted', {
      conceptTerm: termKey(term),
      taskType: type,
      truth,
      budget,
      stamp,
    });
}

/** Log a concept removal. */
export function logConceptRemoved(log: EpisodicMemory, term: Term): () => Promise<void> {
  return () => createFoldAppender(log)('concept_removed', { conceptTerm: termKey(term) });
}

/** Log a concept archival. */
export function logConceptArchived(log: EpisodicMemory, term: Term): () => Promise<void> {
  return () => createFoldAppender(log)('concept_archived', { conceptTerm: termKey(term) });
}

/** Log a link addition. */
export function logLinkAdded(
  log: EpisodicMemory,
  source: Term,
  target: Term,
  layer: string,
  priority: number
): () => Promise<void> {
  return () =>
    createFoldAppender(log)('link_added', {
      linkSource: termKey(source),
      linkTarget: termKey(target),
      linkLayer: layer,
      linkPriority: priority,
    });
}

/** Log a link removal. */
export function logLinkRemoved(log: EpisodicMemory, source: Term, target: Term, layer: string): () => Promise<void> {
  return () =>
    createFoldAppender(log)('link_removed', {
      linkSource: termKey(source),
      linkTarget: termKey(target),
      linkLayer: layer,
    });
}

/** Log a revision. */
export function logRevision(
  log: EpisodicMemory,
  termKeyStr: string,
  truth: BeliefTruth,
  stampId: string,
  source: 'input' | 'derivation' | 'revision' | 'inference'
): () => Promise<void> {
  return () =>
    createFoldAppender(log)('revision_recorded', {
      revisionTermKey: termKeyStr,
      revisionTruth: truth,
      revisionStampId: stampId,
      source,
    });
}

/** Log a consolidation run. */
export function logConsolidation(log: EpisodicMemory, cycles: number): () => Promise<void> {
  return () => createFoldAppender(log)('consolidation_run', { consolidationCycles: cycles });
}

/** Log an eviction run. */
export function logEviction(log: EpisodicMemory, reason: string): () => Promise<void> {
  return () => createFoldAppender(log)('eviction_run', { evictionReason: reason });
}

/** Rebuild focus from current concepts. */
export function rebuildFocus(
  focus: Focus,
  concepts: Map<string, ConceptProjection>,
  focusMaxConcepts: number
): void {
  focus.clearFocus();
  const resident = [...concepts.values()].filter((c) => !c.isArchived);
  const top = selectTopN(resident, focusMaxConcepts, (c) => c.concept.priority);
  for (const c of top) {
    focus.addToFocus(c.concept);
  }
}