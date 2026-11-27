/**
 * Successor Generation — generates possible next states for economy tasks.
 */
import { termFactory, TermOp } from '../../kernel/terms';
import { createDefaultClock } from '../../kernel/env';
/**
 * Generate successors for a task.
 */
export function generateSuccessors(context, clock) {
    const { task, tasks, oracleOperations, facultyNames, iteration } = context;
    const successors = [];
    // Generate based on task kind
    switch (task.kind) {
        case 'goal':
            successors.push(...generateGoalSuccessors(task, tasks, oracleOperations, facultyNames, clock));
            break;
        case 'belief':
            successors.push(...generateBeliefSuccessors(task, tasks, iteration, clock));
            break;
        case 'skill':
            successors.push(...generateSkillSuccessors(task, tasks, facultyNames, clock));
            break;
        case 'faculty':
            successors.push(...generateFacultySuccessors(task, tasks, facultyNames, clock));
            break;
        case 'rule':
            successors.push(...generateRuleSuccessors(task, tasks, clock));
            break;
        case 'plan':
            successors.push(...generatePlanSuccessors(task, tasks, oracleOperations, facultyNames, clock));
            break;
    }
    // Always add internal successor (no-op / maintenance)
    successors.push({
        tasks: [task],
        probability: 0.1,
        utilityDelta: 0,
        source: 'internal',
        operation: 'maintain',
        args: {},
    });
    // Normalize probabilities
    const totalProb = successors.reduce((sum, s) => sum + s.probability, 0);
    if (totalProb > 0) {
        for (const s of successors) {
            s.probability /= totalProb;
        }
    }
    return successors;
}
/** Generate successors for goal tasks. */
function generateGoalSuccessors(task, _tasks, oracleOperations, facultyNames, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    // Oracle-based achievement
    for (const op of oracleOperations) {
        if (op.includes('achieve') || op.includes('execute') || op.includes('solve')) {
            successors.push({
                tasks: [
                    createTask(task.id + '-achieved', task.term, 'belief', task.truth, task.weight * 1.2, task.source),
                ],
                probability: 0.3 / oracleOperations.length,
                utilityDelta: task.weight * 0.5,
                source: 'oracle',
                operation: op,
                args: { goal: task.term.toString() },
            });
        }
    }
    // Faculty-based achievement
    for (const faculty of facultyNames) {
        if (faculty.includes('goal') || faculty.includes('plan') || faculty.includes('execute')) {
            successors.push({
                tasks: [
                    createTask(task.id + '-faculty', task.term, 'belief', task.truth, task.weight, task.source),
                ],
                probability: 0.2 / facultyNames.length,
                utilityDelta: task.weight * 0.4,
                source: 'faculty',
                operation: faculty,
                args: { goal: task.term.toString() },
            });
        }
    }
    // Decomposition into subgoals
    const subgoals = decomposeGoal(task.term);
    if (subgoals.length > 1) {
        const subTasks = subgoals.map((sg, i) => createTask(`${task.id}-sub${i}`, sg, 'goal', task.truth, task.weight / subgoals.length, task.source));
        successors.push({
            tasks: subTasks,
            probability: 0.25,
            utilityDelta: task.weight * 0.3,
            source: 'derivation',
            operation: 'decompose',
            args: { subgoals: subgoals.map(t => t.toString()) },
        });
    }
    return successors;
}
/** Generate successors for belief tasks. */
function generateBeliefSuccessors(task, tasks, iteration, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    // Find related beliefs for revision
    const related = findRelatedBeliefs(task, tasks);
    for (const rel of related.slice(0, 3)) {
        successors.push({
            tasks: [
                createTask(`${task.id}-revised-${rel.id}`, termFactory.compound(TermOp.CONJUNCTION, [task.term, rel.term]), 'belief', { f: 0.9, c: 0.8 }, task.weight * 0.8, task.source),
            ],
            probability: 0.15 / related.length,
            utilityDelta: task.weight * 0.2,
            source: 'derivation',
            operation: 'revise',
            args: { with: rel.id },
        });
    }
    // Contradiction detection
    const contradictions = findContradictions(task, tasks);
    for (const contra of contradictions.slice(0, 2)) {
        successors.push({
            tasks: [
                createTask(`${task.id}-resolved-${contra.id}`, task.term, 'belief', { f: task.truth.f * 0.5, c: task.truth.c * 0.5 }, task.weight * 0.6, task.source),
            ],
            probability: 0.1 / contradictions.length,
            utilityDelta: -task.weight * 0.1,
            source: 'derivation',
            operation: 'resolve-contradiction',
            args: { contradiction: contra.id },
        });
    }
    // Rule application
    const applicableRules = findApplicableRules(task, tasks);
    for (const rule of applicableRules.slice(0, 3)) {
        successors.push({
            tasks: [
                createTask(`${task.id}-derived-${iteration}`, rule.conclusion, 'belief', rule.truth, task.weight * 0.9, 'derivation'),
            ],
            probability: 0.2 / applicableRules.length,
            utilityDelta: task.weight * 0.3,
            source: 'derivation',
            operation: 'apply-rule',
            args: { premise: task.term.toString() },
        });
    }
    return successors;
}
/** Generate successors for skill tasks. */
function generateSkillSuccessors(task, _tasks, facultyNames, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    // Practice/refinement
    for (const faculty of facultyNames) {
        if (faculty.includes('skill') || faculty.includes('practice') || faculty.includes('train')) {
            successors.push({
                tasks: [
                    createTask(`${task.id}-practiced`, task.term, 'skill', { f: Math.min(1.0, task.truth.f + 0.1), c: Math.min(1.0, task.truth.c + 0.05) }, task.weight * 1.1, task.source),
                ],
                probability: 0.4 / facultyNames.length,
                utilityDelta: task.weight * 0.2,
                source: 'faculty',
                operation: faculty,
                args: { skill: task.term.toString() },
            });
        }
    }
    return successors;
}
/** Generate successors for faculty tasks. */
function generateFacultySuccessors(task, _tasks, facultyNames, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    for (const faculty of facultyNames) {
        successors.push({
            tasks: [
                createTask(`${task.id}-${faculty}`, task.term, 'belief', task.truth, task.weight, task.source),
            ],
            probability: 0.3 / facultyNames.length,
            utilityDelta: task.weight * 0.25,
            source: 'faculty',
            operation: faculty,
            args: { faculty },
        });
    }
    return successors;
}
/** Generate successors for rule tasks. */
function generateRuleSuccessors(task, tasks, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    // Apply rule to matching premises
    const premises = extractPlanSteps(task.term);
    for (const premise of premises.slice(0, 3)) {
        const matching = tasks.filter(t => t.term.toString().includes(premise.action) || t.term.toString().includes(premise.term.toString()));
        if (matching.length > 0) {
            successors.push({
                tasks: matching.map(m => createTask(`${task.id}-applied-${m.id}`, m.term, 'belief', m.truth, m.weight, 'derivation')),
                probability: 0.25,
                utilityDelta: task.weight * 0.4,
                source: 'derivation',
                operation: 'apply-rule',
                args: { rule: task.term.toString() },
            });
        }
    }
    return successors;
}
/** Generate successors for plan tasks. */
function generatePlanSuccessors(task, _tasks, oracleOperations, facultyNames, clock) {
    const successors = [];
    const createTask = createTaskFactory(clock);
    const steps = extractPlanSteps(task.term);
    for (const step of steps.slice(0, 5)) {
        // Try oracle first
        const oracleMatch = oracleOperations.find(op => op.includes(step.action) || op.includes(step.term.toString().toLowerCase()));
        if (oracleMatch) {
            successors.push({
                tasks: [
                    createTask(`${task.id}-step-${step.action}`, step.term, 'goal', { f: 1.0, c: 0.9 }, task.weight * 0.8, 'oracle'),
                ],
                probability: 0.3 / steps.length,
                utilityDelta: task.weight * 0.5,
                source: 'oracle',
                operation: oracleMatch,
                args: step.args,
            });
        }
        else {
            // Try faculty
            const facultyMatch = facultyNames.find(f => f.includes(step.action) || f.includes(step.term.toString().toLowerCase()));
            if (facultyMatch) {
                successors.push({
                    tasks: [
                        createTask(`${task.id}-step-${step.action}`, step.term, 'goal', { f: 1.0, c: 0.8 }, task.weight * 0.7, 'faculty'),
                    ],
                    probability: 0.25 / steps.length,
                    utilityDelta: task.weight * 0.4,
                    source: 'faculty',
                    operation: facultyMatch,
                    args: step.args,
                });
            }
        }
    }
    return successors;
}
/** Create a task factory with optional clock. */
function createTaskFactory(clock) {
    const c = clock ?? createDefaultClock();
    return (id, term, kind, truth, weight, source) => ({
        id,
        term,
        type: 'belief',
        priority: weight,
        kind,
        truth,
        weight,
        source,
        activation: 1.0,
        createdAt: c.now(),
        lastAccessed: c.now(),
        accessCount: 0,
        dependencies: [],
        derived: false,
        tags: [],
    });
}
/** Decompose a goal term into subgoals. */
function decomposeGoal(term) {
    if (term.op === TermOp.CONJUNCTION || term.op === TermOp.SEQUENTIAL) {
        return [...(term.args ?? [])];
    }
    return [term];
}
/** Find beliefs related to a task. */
function findRelatedBeliefs(task, tasks) {
    return tasks.filter(t => t.kind === 'belief' &&
        t.id !== task.id &&
        (t.term.toString().includes(task.term.toString()) || task.term.toString().includes(t.term.toString())));
}
/** Find contradictions for a task. */
function findContradictions(task, tasks) {
    return tasks.filter(t => t.kind === 'belief' &&
        t.id !== task.id &&
        t.term.toString() === `¬${task.term.toString()}`);
}
/** Find applicable rules for a task. */
function findApplicableRules(task, tasks) {
    return tasks
        .filter(t => t.kind === 'rule')
        .map(t => ({
        conclusion: t.term,
        truth: t.truth,
    }))
        .slice(0, 5);
}
/** Extract plan steps from a plan term. */
function extractPlanSteps(term) {
    if (term.op === TermOp.SEQUENTIAL) {
        return term.args.map((arg, i) => ({
            action: `step${i}`,
            term: arg,
            args: {},
        }));
    }
    return [{ action: 'execute', term, args: {} }];
}
/** Jaccard similarity for string comparison. */
function jaccardSimilarity(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
}
