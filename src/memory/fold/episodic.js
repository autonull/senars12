/**
 * Episodic Fold — log replay and projection building.
 */
import { getOrInsert, selectTopN } from '@senars/util/collections';
import { NullAttentionModel } from '../../strategies/attention/NullAttentionModel';
import { Stamp, Truth, termKey, } from '../../terms';
import { atom } from '../../terms/impls/factory';
import { NEUTRAL_BUDGET } from '../../types';
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
];
/** Build initial projections from episodes. */
export function buildProjectionsFromLog(episodes, config) {
    const concepts = new Map();
    const tasks = new Map();
    const links = new Map();
    const revisions = [];
    const archiveLog = [];
    // Sort by timestamp to replay in order
    const sorted = [...episodes].sort((a, b) => a.timestamp - b.timestamp);
    for (const ep of sorted) {
        applyEpisode(ep, concepts, tasks, links, revisions, archiveLog, config);
    }
    return { concepts, tasks, links, revisions, archiveLog };
}
/** Apply a single episode to projections. */
function applyEpisode(ep, concepts, tasks, links, revisions, archiveLog, _config) {
    const meta = ep.metadata;
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
                        },
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
                        const idx = layerLinks.findIndex((l) => l.source === meta.linkSource && l.target === meta.linkTarget);
                        if (idx >= 0)
                            layerLinks.splice(idx, 1);
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
                        source: (meta.source ?? 'input'),
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
export function createFoldAppender(log) {
    return (foldOp, payload) => log.log('belief_added', `fold:${foldOp}`, {
        ...payload,
        foldOp,
    });
}
/** Log a concept addition. */
export function logConceptAdded(log, term) {
    return () => createFoldAppender(log)('concept_added', { conceptTerm: termKey(term) });
}
/** Log a task admission. */
export function logTaskAdmitted(log, term, type, truth, budget, stamp) {
    return () => createFoldAppender(log)('task_admitted', {
        conceptTerm: termKey(term),
        taskType: type,
        truth,
        budget,
        stamp,
    });
}
/** Log a concept removal. */
export function logConceptRemoved(log, term) {
    return () => createFoldAppender(log)('concept_removed', { conceptTerm: termKey(term) });
}
/** Log a concept archival. */
export function logConceptArchived(log, term) {
    return () => createFoldAppender(log)('concept_archived', { conceptTerm: termKey(term) });
}
/** Log a link addition. */
export function logLinkAdded(log, source, target, layer, priority) {
    return () => createFoldAppender(log)('link_added', {
        linkSource: termKey(source),
        linkTarget: termKey(target),
        linkLayer: layer,
        linkPriority: priority,
    });
}
/** Log a link removal. */
export function logLinkRemoved(log, source, target, layer) {
    return () => createFoldAppender(log)('link_removed', {
        linkSource: termKey(source),
        linkTarget: termKey(target),
        linkLayer: layer,
    });
}
/** Log a revision. */
export function logRevision(log, termKeyStr, truth, stampId, source) {
    return () => createFoldAppender(log)('revision_recorded', {
        revisionTermKey: termKeyStr,
        revisionTruth: truth,
        revisionStampId: stampId,
        source,
    });
}
/** Log a consolidation run. */
export function logConsolidation(log, cycles) {
    return () => createFoldAppender(log)('consolidation_run', { consolidationCycles: cycles });
}
/** Log an eviction run. */
export function logEviction(log, reason) {
    return () => createFoldAppender(log)('eviction_run', { evictionReason: reason });
}
/** Rebuild focus from current concepts. */
export function rebuildFocus(focus, concepts, focusMaxConcepts) {
    focus.clearFocus();
    const resident = [...concepts.values()].filter((c) => !c.isArchived);
    const top = selectTopN(resident, focusMaxConcepts, (c) => c.concept.priority);
    for (const c of top) {
        focus.addToFocus(c.concept);
    }
}
