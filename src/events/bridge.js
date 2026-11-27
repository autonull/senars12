import { mintCognitiveEvent as mint } from '@senars/schemas/cognitive-events';
import { events } from './emitter';
/** Add handler for both old and new event names. */
function addHandler(map, oldName, newName, handler) {
    map.set(oldName, handler);
    map.set(newName, handler);
}
const handlers = new Map();
// Kernel events
addHandler(handlers, 'cycle:state', events.kernel.cycleState(), (data) => {
    const d = data;
    return mint('cycle', {
        engine: 'nar',
        cycle: d.cycle,
        derived: d.derived,
        payload: {
            cycle: d.cycle,
            derived: d.derived,
            state: d.state,
            phase: d.phase,
            activeTasks: d.activeTasks,
            budget: d.budget,
        },
    });
});
addHandler(handlers, 'restore:state', events.kernel.restoreState(), (data) => {
    const d = data;
    return mint('bootstrap', {
        engine: 'nar',
        payload: {
            restored: {
                cycleCount: d.cycleCount,
                concepts: d.concepts,
                pendingTasks: d.pendingTasks,
            },
        },
    });
});
addHandler(handlers, 'memory:pressure', events.kernel.memoryPressure(), (data) => {
    const d = data;
    return mint('memory.pressure', {
        engine: 'nar',
        payload: { level: d.level, utilization: d.utilization },
    });
});
addHandler(handlers, 'memory:consolidated', events.kernel.memoryConsolidated(), (data) => {
    const d = data;
    return mint('memory.consolidated', {
        engine: 'nar',
        payload: { conceptsRemoved: d.conceptsRemoved, conceptsArchived: d.conceptsArchived },
    });
});
addHandler(handlers, 'lm:call', events.kernel.lmCall(), (data) => {
    const d = data;
    return mint('lm.call', {
        engine: 'nar',
        payload: { modelId: d.modelId, inputTokens: d.inputTokens, outputTokens: d.outputTokens, duration: d.duration },
    });
});
addHandler(handlers, 'lm:error', events.kernel.lmError(), (data) => {
    const d = data;
    return mint('lm.error', {
        engine: 'nar',
        payload: { modelId: d.ruleId, error: String(d.error), duration: d.duration },
    });
});
addHandler(handlers, 'error', events.kernel.error(), (data) => {
    const d = data;
    return mint('error', {
        engine: 'nar',
        payload: { message: String(d.error), context: d.context },
    });
});
// NL events
addHandler(handlers, 'nl:analyzed', events.nl.analyzed(), (data) => {
    const d = data;
    return mint('nl.analyzed', {
        engine: 'nar',
        payload: { text: d.input, intent: 'unknown', entities: [] },
    });
});
addHandler(handlers, 'nl:translation', events.nl.translation(), (data) => {
    const d = data;
    return mint('nl.translation', {
        engine: 'nar',
        payload: { source: d.nl, target: d.narsese, confidence: 1.0 },
    });
});
addHandler(handlers, 'nl:clarification-needed', events.nl.clarificationNeeded(), (data) => {
    const d = data;
    return mint('nl.clarification_needed', {
        engine: 'nar',
        payload: { text: String(d.ambiguity), reason: 'clarification needed' },
    });
});
// NAL events
addHandler(handlers, 'nal:derived', events.cognition.nalDerived(), (data) => {
    const d = data;
    return mint('nal.derived', {
        engine: 'nar',
        payload: { term: d.conclusion, space: 'nal', truth: d.truth },
    });
});
// LM validation
addHandler(handlers, 'lm:validation-failed', events.cognition.lmValidationFailed(), (data) => {
    const d = data;
    return mint('lm.validation_failed', {
        engine: 'nar',
        payload: { output: d.output, reason: d.reason },
    });
});
// Feedback
addHandler(handlers, 'feedback:correction', events.cognition.feedbackCorrection(), (data) => {
    const d = data;
    return mint('feedback.correction', {
        engine: 'nar',
        payload: { original: d.original, corrected: d.corrected, source: 'cognition' },
    });
});
// System events (pipeline)
addHandler(handlers, 'turn:start', events.system.turnStart(), (data) => {
    const d = data;
    return mint('turn.start', {
        engine: 'nar',
        payload: { turnId: `turn-${d.passCount}`, input: String(d.input) },
    });
});
addHandler(handlers, 'turn:end', events.system.turnEnd(), (data) => {
    const d = data;
    return mint('turn.end', {
        engine: 'nar',
        payload: { turnId: `turn-end`, output: String(d.response), durationMs: d.durationMs },
    });
});
addHandler(handlers, 'turn:error', events.system.turnError(), (data) => {
    const d = data;
    return mint('turn.error', {
        engine: 'nar',
        payload: { turnId: `turn-error-${d.passCount}`, error: String(d.error) },
    });
});
addHandler(handlers, 'stage:start', events.system.stageStart(), (data) => {
    const d = data;
    return mint('stage.start', {
        engine: 'nar',
        payload: { stage: d.stage, turnId: `turn-${d.passCount}` },
    });
});
addHandler(handlers, 'stage:end', events.system.stageEnd(), (data) => {
    const d = data;
    return mint('stage.end', {
        engine: 'nar',
        payload: { stage: d.stage, turnId: `turn-${d.passCount}`, durationMs: d.durationMs },
    });
});
addHandler(handlers, 'stage:error', events.system.stageError(), (data) => {
    const d = data;
    return mint('stage.error', {
        engine: 'nar',
        payload: { stage: d.stage, turnId: `turn-unknown`, error: String(d.error) },
    });
});
addHandler(handlers, 'classify:result', events.system.classifyResult(), (data) => {
    const d = data;
    return mint('classify.result', {
        engine: 'nar',
        payload: { category: String(d.classification), confidence: 1.0 },
    });
});
addHandler(handlers, 'trigger:score', events.system.triggerScore(), (data) => {
    const d = data;
    return mint('trigger.score', {
        engine: 'nar',
        payload: { trigger: 'combined', score: d.total },
    });
});
addHandler(handlers, 'reasoning:start', events.system.reasoningStart(), (data) => {
    const d = data;
    return mint('reasoning.start', {
        engine: 'nar',
        payload: { query: d.inputType, mode: 'reasoning' },
    });
});
addHandler(handlers, 'reasoning:end', events.system.reasoningEnd(), (data) => {
    const d = data;
    return mint('reasoning.end', {
        engine: 'nar',
        payload: { query: 'reasoning', result: d.newBeliefs.map(String).join(', '), durationMs: 0 },
    });
});
addHandler(handlers, 'lm:start', events.system.lmStart(), (data) => {
    const d = data;
    return mint('lm.start', {
        engine: 'nar',
        payload: { modelId: 'unknown', prompt: `prompt-length-${d.promptLength}` },
    });
});
addHandler(handlers, 'lm:chunk', events.system.lmChunk(), (data) => {
    const d = data;
    return mint('lm.chunk', {
        engine: 'nar',
        payload: { modelId: 'unknown', chunk: d.content },
    });
});
addHandler(handlers, 'lm:end', events.system.lmEnd(), (data) => {
    const d = data;
    return mint('lm.end', {
        engine: 'nar',
        payload: { modelId: 'unknown', response: d.response, durationMs: d.durationMs },
    });
});
addHandler(handlers, 'lm:suggests-reasoning', events.system.lmSuggestsReasoning(), (data) => {
    const d = data;
    return mint('lm.suggests_reasoning', {
        engine: 'nar',
        payload: { suggestion: String(d), confidence: d ? 1.0 : 0.0 },
    });
});
addHandler(handlers, 'lm-rule:executed', events.system.lmRuleExecuted(), (data) => {
    const d = data;
    return mint('lm_rule.executed', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, input: `duration-${d.durationMs}`, output: `tasks-${d.tasksGenerated}` },
    });
});
addHandler(handlers, 'lm-rule:failed', events.system.lmRuleFailed(), (data) => {
    const d = data;
    return mint('lm_rule.failed', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, error: d.error },
    });
});
addHandler(handlers, 'lm-rule:disabled', events.system.lmRuleDisabled(), (data) => {
    const d = data;
    return mint('lm_rule.disabled', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, reason: 'disabled' },
    });
});
addHandler(handlers, 'directive:found', events.system.directiveFound(), (data) => {
    const d = data;
    return mint('directive.found', {
        engine: 'nar',
        payload: { directive: String(d.directive), target: 'unknown' },
    });
});
addHandler(handlers, 'directive:execute', events.system.directiveExecute(), (data) => {
    const d = data;
    return mint('directive.execute', {
        engine: 'nar',
        payload: { directive: String(d.directive), args: { success: d.success, result: d.result, error: d.error } },
    });
});
addHandler(handlers, 'directive:loop-requested', events.system.directiveLoopRequested(), (data) => {
    const d = data;
    return mint('directive.loop_requested', {
        engine: 'nar',
        payload: { directive: d.type, reason: 'loop requested' },
    });
});
addHandler(handlers, 'loop:pass', events.system.loopPass(), (data) => {
    const d = data;
    return mint('loop.pass', {
        engine: 'nar',
        payload: { pass: d.passCount, actions: d.needsLoopBack ? ['loop-back'] : [] },
    });
});
// Conversation events
addHandler(handlers, 'conversation:message-added', events.system.conversationMessageAdded(), (data) => {
    const d = data;
    return mint('conversation.message_added', {
        engine: 'nar',
        payload: { role: 'assistant', content: String(d.message) },
    });
});
addHandler(handlers, 'conversation:artifact-added', events.system.conversationArtifactAdded(), (data) => {
    const d = data;
    return mint('conversation.artifact_added', {
        engine: 'nar',
        payload: { type: 'artifact', content: String(d.artifact) },
    });
});
addHandler(handlers, 'conversation:belief-pinned', events.system.conversationBeliefPinned(), (data) => {
    const d = data;
    return mint('conversation.belief_pinned', {
        engine: 'nar',
        payload: { term: d.belief, pinned: true },
    });
});
addHandler(handlers, 'conversation:summarized', events.system.conversationSummarized(), (data) => {
    const d = data;
    return mint('conversation.summarized', {
        engine: 'nar',
        payload: { summary: d.summary, messageCount: 0 },
    });
});
// System LM rule events
addHandler(handlers, 'system:lm.rule:applied', events.lm.ruleApplied(), (data) => {
    const d = data;
    return mint('system_lm_rule.applied', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, result: d.output },
    });
});
addHandler(handlers, 'system:lm.rule:skipped', events.lm.ruleSkipped(), (data) => {
    const d = data;
    return mint('system_lm_rule.skipped', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, reason: d.reason },
    });
});
addHandler(handlers, 'system:lm.rule:structured', events.lm.ruleStructured(), (data) => {
    const d = data;
    return mint('system_lm_rule.structured', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, schema: d.schema },
    });
});
addHandler(handlers, 'system:lm.rule:tool:called', events.lm.ruleToolCalled(), (data) => {
    const d = data;
    return mint('system_lm_rule.tool_called', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, tool: d.tool, args: d.args },
    });
});
addHandler(handlers, 'system:lm.rule:tool:result', events.lm.ruleToolResult(), (data) => {
    const d = data;
    return mint('system_lm_rule.tool_result', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, tool: d.tool, result: d.result },
    });
});
addHandler(handlers, 'system:lm.rule:failed', events.lm.ruleFailed(), (data) => {
    const d = data;
    return mint('system_lm_rule.failed', {
        engine: 'nar',
        payload: { ruleId: d.ruleId, error: d.error },
    });
});
addHandler(handlers, 'system:lm.rule:circuit:open', events.lm.ruleCircuitOpen(), (data) => {
    const d = data;
    return mint('system_lm_rule.circuit_open', {
        engine: 'nar',
        payload: { ruleId: d.ruleId },
    });
});
addHandler(handlers, 'system:lm.rule:circuit:half-open', events.lm.ruleCircuitHalfOpen(), (data) => {
    const d = data;
    return mint('system_lm_rule.circuit_half_open', {
        engine: 'nar',
        payload: { ruleId: d.ruleId },
    });
});
addHandler(handlers, 'system:lm.rule:circuit:closed', events.lm.ruleCircuitClosed(), (data) => {
    const d = data;
    return mint('system_lm_rule.circuit_closed', {
        engine: 'nar',
        payload: { ruleId: d.ruleId },
    });
});
// Cognition events
addHandler(handlers, 'rule:applied', events.cognition.ruleApplied(), (data) => {
    const d = data;
    return mint('derivation.made', {
        engine: 'nar',
        payload: {
            rule: d.ruleId,
            premises: d.premises.map(String),
            conclusion: String(d.conclusion),
            cpuMs: d.cpuMs,
            lmCalls: d.lmCalls,
            lmTokens: d.lmTokens,
        },
    });
});
addHandler(handlers, 'derivation:accepted', events.cognition.derivationAccepted(), (data) => {
    const d = data;
    return mint('derivation.accepted', {
        engine: 'nar',
        ...(d.correlationId ? { correlationId: d.correlationId } : {}),
        payload: {
            derivationId: d.stepId,
            ruleId: d.ruleId,
            ruleCategory: d.ruleCategory,
            premises: d.premises,
            conclusion: d.conclusion,
            truth: d.truth,
            premiseTruths: d.premiseTruths,
            truthFn: d.truthFn,
            evidenceLineage: d.evidenceLineage,
            independenceCheck: d.independence,
            cycle: d.cycle,
            ...(d.correlationId ? { correlationId: d.correlationId } : {}),
        },
    });
});
addHandler(handlers, 'derivation:record', events.cognition.derivationRecord(), (data) => {
    const d = data;
    return mint('derivation.record', { engine: 'nar', payload: d });
});
addHandler(handlers, 'concept:created', events.cognition.conceptCreated(), (data) => {
    const d = data;
    return mint('concept.activated', {
        engine: 'nar',
        payload: { term: String(d.term), priority: d.priority },
    });
});
addHandler(handlers, 'concept:removed', events.cognition.conceptRemoved(), (data) => {
    const d = data;
    return mint('belief.retracted', {
        engine: 'nar',
        payload: { term: String(d.term) },
    });
});
addHandler(handlers, 'cognitive:state-change', events.cognition.stateChange(), (data) => {
    const d = data;
    return mint('drive.changed', {
        engine: 'nar',
        payload: { drive: `cognitive:${d.action}`, urgency: 0.5 },
    });
});
// Tool events
addHandler(handlers, 'tool:call', events.tool.call(), (data) => {
    const d = data;
    return mint('tool.request', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: { toolName: d.name, args: d.args },
    });
});
addHandler(handlers, 'tool:result', events.tool.result(), (data) => {
    const d = data;
    return mint('tool.response', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: {
            requestId: `${d.type}:${d.name}`,
            toolName: d.name,
            result: d.result,
            durationMs: d.duration,
        },
    });
});
addHandler(handlers, 'tool:error', events.tool.error(), (data) => {
    const d = data;
    return mint('tool.response', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: {
            requestId: `${d.type}:${d.name}`,
            toolName: d.name,
            error: String(d.result),
            durationMs: d.duration,
        },
    });
});
// System events
addHandler(handlers, 'lm:start', events.system.lmStart(), (_data) => mint('skill.executed', {
    engine: 'nar',
    payload: { skill: 'lm.generate', args: [], result: '', durationMs: 0 },
}));
export function narEventToCognitive(event, data) {
    const handler = handlers.get(event);
    if (!handler)
        return null;
    return handler(data);
}
/** All NAR event keys that have a CognitiveEvent mapping. */
export const MAPPED_NAR_EVENTS = [...handlers.keys()];
