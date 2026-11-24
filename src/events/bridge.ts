import { type CognitiveEvent, mintCognitiveEvent as mint } from '@senars/schemas/cognitive-events';
import type { NAREventMap } from '../types/events';
import { events } from './emitter';

/**
 * Every NAR event becomes an `engine: 'nar'` cognitive event. The origin is the
 * nar discriminant, not a parameter: `kernel` and `proposer` events are minted
 * at their own construction sites, and threading an origin through here could
 * only ever have produced a `'kernel'` event the nar type does not admit.
 *
 * Each handler below is a one-line `mintCognitiveEvent` — the payload is checked
 * against the schema's own variant, and the timestamp and correlation id are
 * stamped by the mint rather than restated per handler. A tool event keeps the
 * timestamp it was raised at, because that is the latency being measured.
 */
type Handler = (data: unknown) => CognitiveEvent | null;

/** Add handler for both old and new event names. */
function addHandler(map: Map<string, Handler>, oldName: string, newName: string, handler: Handler): void {
  map.set(oldName, handler);
  map.set(newName, handler);
}

const handlers = new Map<string, Handler>();

// Kernel events
addHandler(handlers, 'cycle:state', events.kernel.cycleState(), (data) => {
  const d = data as NAREventMap['cycle:state'];
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
  const d = data as NAREventMap['restore:state'];
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
  const d = data as NAREventMap['memory:pressure'];
  return mint('memory.pressure', {
    engine: 'nar',
    payload: { level: d.level, utilization: d.utilization },
  });
});

addHandler(handlers, 'memory:consolidated', events.kernel.memoryConsolidated(), (data) => {
  const d = data as NAREventMap['memory:consolidated'];
  return mint('memory.consolidated', {
    engine: 'nar',
    payload: { conceptsRemoved: d.conceptsRemoved, conceptsArchived: d.conceptsArchived },
  });
});

addHandler(handlers, 'lm:call', events.kernel.lmCall(), (data) => {
  const d = data as NAREventMap['lm:call'];
  return mint('lm.call', {
    engine: 'nar',
    payload: { modelId: d.modelId, inputTokens: d.inputTokens, outputTokens: d.outputTokens, duration: d.duration },
  });
});

addHandler(handlers, 'lm:error', events.kernel.lmError(), (data) => {
  const d = data as NAREventMap['lm:error'];
  return mint('lm.error', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, error: String(d.error), duration: d.duration },
  });
});

addHandler(handlers, 'error', events.kernel.error(), (data) => {
  const d = data as NAREventMap['error'];
  return mint('error', {
    engine: 'nar',
    payload: { error: String(d.error), context: d.context },
  });
});

// NL events
addHandler(handlers, 'nl:analyzed', events.nl.analyzed(), (data) => {
  const d = data as NAREventMap['nl:analyzed'];
  return mint('nl.analyzed', {
    engine: 'nar',
    payload: { input: d.input, analysis: d.analysis },
  });
});

addHandler(handlers, 'nl:translation', events.nl.translation(), (data) => {
  const d = data as NAREventMap['nl:translation'];
  return mint('nl.translation', {
    engine: 'nar',
    payload: { nl: d.nl, narsese: d.narsese, tier: d.tier },
  });
});

addHandler(handlers, 'nl:clarification-needed', events.nl.clarificationNeeded(), (data) => {
  const d = data as NAREventMap['nl:clarification-needed'];
  return mint('nl.clarification_needed', {
    engine: 'nar',
    payload: { ambiguity: d.ambiguity },
  });
});

// NAL events
addHandler(handlers, 'nal:derived', events.cognition.nalDerived(), (data) => {
  const d = data as NAREventMap['nal:derived'];
  return mint('nal.derived', {
    engine: 'nar',
    payload: { premises: d.premises, rule: d.rule, conclusion: d.conclusion, truth: d.truth },
  });
});

// LM validation
addHandler(handlers, 'lm:validation-failed', events.cognition.lmValidationFailed(), (data) => {
  const d = data as NAREventMap['lm:validation-failed'];
  return mint('lm.validation_failed', {
    engine: 'nar',
    payload: { output: d.output, reason: d.reason },
  });
});

// Feedback
addHandler(handlers, 'feedback:correction', events.cognition.feedbackCorrection(), (data) => {
  const d = data as NAREventMap['feedback:correction'];
  return mint('feedback.correction', {
    engine: 'nar',
    payload: { original: d.original, corrected: d.corrected },
  });
});

// System events (pipeline)
addHandler(handlers, 'turn:start', events.system.turnStart(), (data) => {
  const d = data as NAREventMap['turn:start'];
  return mint('turn.start', {
    engine: 'nar',
    payload: { input: d.input, passCount: d.passCount },
  });
});

addHandler(handlers, 'turn:end', events.system.turnEnd(), (data) => {
  const d = data as NAREventMap['turn:end'];
  return mint('turn.end', {
    engine: 'nar',
    payload: { response: d.response, durationMs: d.durationMs },
  });
});

addHandler(handlers, 'turn:error', events.system.turnError(), (data) => {
  const d = data as NAREventMap['turn:error'];
  return mint('turn.error', {
    engine: 'nar',
    payload: { error: String(d.error), stage: d.stage, passCount: d.passCount },
  });
});

addHandler(handlers, 'stage:start', events.system.stageStart(), (data) => {
  const d = data as NAREventMap['stage:start'];
  return mint('stage.start', {
    engine: 'nar',
    payload: { stage: d.stage, passCount: d.passCount },
  });
});

addHandler(handlers, 'stage:end', events.system.stageEnd(), (data) => {
  const d = data as NAREventMap['stage:end'];
  return mint('stage.end', {
    engine: 'nar',
    payload: { stage: d.stage, durationMs: d.durationMs, passCount: d.passCount },
  });
});

addHandler(handlers, 'stage:error', events.system.stageError(), (data) => {
  const d = data as NAREventMap['stage:error'];
  return mint('stage.error', {
    engine: 'nar',
    payload: { error: String(d.error), stage: d.stage, durationMs: d.durationMs },
  });
});

addHandler(handlers, 'classify:result', events.system.classifyResult(), (data) => {
  const d = data as NAREventMap['classify:result'];
  return mint('classify.result', {
    engine: 'nar',
    payload: { input: d.input, classification: d.classification },
  });
});

addHandler(handlers, 'trigger:score', events.system.triggerScore(), (data) => {
  const d = data as NAREventMap['trigger:score'];
  return mint('trigger.score', {
    engine: 'nar',
    payload: { heuristicScore: d.heuristicScore, lmScore: d.lmScore, total: d.total, activated: d.activated },
  });
});

addHandler(handlers, 'reasoning:start', events.system.reasoningStart(), (data) => {
  const d = data as NAREventMap['reasoning:start'];
  return mint('reasoning.start', {
    engine: 'nar',
    payload: { inputType: d.inputType, steps: d.steps },
  });
});

addHandler(handlers, 'reasoning:end', events.system.reasoningEnd(), (data) => {
  const d = data as NAREventMap['reasoning:end'];
  return mint('reasoning.end', {
    engine: 'nar',
    payload: { steps: d.steps, newBeliefs: d.newBeliefs },
  });
});

addHandler(handlers, 'lm:start', events.system.lmStart(), (data) => {
  const d = data as NAREventMap['lm:start'];
  return mint('lm.start', {
    engine: 'nar',
    payload: { promptLength: d.promptLength, streaming: d.streaming },
  });
});

addHandler(handlers, 'lm:chunk', events.system.lmChunk(), (data) => {
  const d = data as NAREventMap['lm:chunk'];
  return mint('lm.chunk', {
    engine: 'nar',
    payload: { content: d.content, accumulated: d.accumulated },
  });
});

addHandler(handlers, 'lm:end', events.system.lmEnd(), (data) => {
  const d = data as NAREventMap['lm:end'];
  return mint('lm.end', {
    engine: 'nar',
    payload: { response: d.response, durationMs: d.durationMs },
  });
});

addHandler(handlers, 'lm:suggests-reasoning', events.system.lmSuggestsReasoning(), (data) => {
  const d = data as NAREventMap['lm:suggests-reasoning'];
  return mint('lm.suggests_reasoning', {
    engine: 'nar',
    payload: { value: d },
  });
});

addHandler(handlers, 'lm-rule:executed', events.system.lmRuleExecuted(), (data) => {
  const d = data as NAREventMap['lm-rule:executed'];
  return mint('lm_rule.executed', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, durationMs: d.durationMs, tasksGenerated: d.tasksGenerated },
  });
});

addHandler(handlers, 'lm-rule:failed', events.system.lmRuleFailed(), (data) => {
  const d = data as NAREventMap['lm-rule:failed'];
  return mint('lm_rule.failed', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, error: d.error, durationMs: d.durationMs },
  });
});

addHandler(handlers, 'lm-rule:disabled', events.system.lmRuleDisabled(), (data) => {
  const d = data as NAREventMap['lm-rule:disabled'];
  return mint('lm_rule.disabled', {
    engine: 'nar',
    payload: { ruleId: d.ruleId },
  });
});

addHandler(handlers, 'directive:found', events.system.directiveFound(), (data) => {
  const d = data as NAREventMap['directive:found'];
  return mint('directive.found', {
    engine: 'nar',
    payload: { directive: d.directive },
  });
});

addHandler(handlers, 'directive:execute', events.system.directiveExecute(), (data) => {
  const d = data as NAREventMap['directive:execute'];
  return mint('directive.execute', {
    engine: 'nar',
    payload: { directive: d.directive, success: d.success, result: d.result, error: d.error },
  });
});

addHandler(handlers, 'directive:loop-requested', events.system.directiveLoopRequested(), (data) => {
  const d = data as NAREventMap['directive:loop-requested'];
  return mint('directive.loop_requested', {
    engine: 'nar',
    payload: { type: d.type },
  });
});

addHandler(handlers, 'loop:pass', events.system.loopPass(), (data) => {
  const d = data as NAREventMap['loop:pass'];
  return mint('loop.pass', {
    engine: 'nar',
    payload: { passCount: d.passCount, needsLoopBack: d.needsLoopBack },
  });
});

// Conversation events
addHandler(handlers, 'conversation:message-added', events.system.conversationMessageAdded(), (data) => {
  const d = data as NAREventMap['conversation:message-added'];
  return mint('conversation.message_added', {
    engine: 'nar',
    payload: { message: d.message, count: d.count },
  });
});

addHandler(handlers, 'conversation:artifact-added', events.system.conversationArtifactAdded(), (data) => {
  const d = data as NAREventMap['conversation:artifact-added'];
  return mint('conversation.artifact_added', {
    engine: 'nar',
    payload: { artifact: d.artifact, count: d.count },
  });
});

addHandler(handlers, 'conversation:belief-pinned', events.system.conversationBeliefPinned(), (data) => {
  const d = data as NAREventMap['conversation:belief-pinned'];
  return mint('conversation.belief_pinned', {
    engine: 'nar',
    payload: { belief: d.belief, count: d.count },
  });
});

addHandler(handlers, 'conversation:summarized', events.system.conversationSummarized(), (data) => {
  const d = data as NAREventMap['conversation:summarized'];
  return mint('conversation.summarized', {
    engine: 'nar',
    payload: { summary: d.summary },
  });
});

// System LM rule events
addHandler(handlers, 'system:lm.rule:applied', events.lm.ruleApplied(), (data) => {
  const d = data as NAREventMap['system:lm.rule:applied'];
  return mint('system_lm_rule.applied', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, durationMs: d.durationMs, output: d.output, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:skipped', events.lm.ruleSkipped(), (data) => {
  const d = data as NAREventMap['system:lm.rule:skipped'];
  return mint('system_lm_rule.skipped', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, reason: d.reason, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:structured', events.lm.ruleStructured(), (data) => {
  const d = data as NAREventMap['system:lm.rule:structured'];
  return mint('system_lm_rule.structured', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, schema: d.schema, output: d.output, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:tool:called', events.lm.ruleToolCalled(), (data) => {
  const d = data as NAREventMap['system:lm.rule:tool:called'];
  return mint('system_lm_rule.tool_called', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, tool: d.tool, args: d.args, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:tool:result', events.lm.ruleToolResult(), (data) => {
  const d = data as NAREventMap['system:lm.rule:tool:result'];
  return mint('system_lm_rule.tool_result', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, tool: d.tool, result: d.result, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:failed', events.lm.ruleFailed(), (data) => {
  const d = data as NAREventMap['system:lm.rule:failed'];
  return mint('system_lm_rule.failed', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, error: d.error, durationMs: d.durationMs, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:circuit:open', events.lm.ruleCircuitOpen(), (data) => {
  const d = data as NAREventMap['system:lm.rule:circuit:open'];
  return mint('system_lm_rule.circuit_open', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:circuit:half-open', events.lm.ruleCircuitHalfOpen(), (data) => {
  const d = data as NAREventMap['system:lm.rule:circuit:half-open'];
  return mint('system_lm_rule.circuit_half_open', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, timestamp: d.timestamp },
  });
});

addHandler(handlers, 'system:lm.rule:circuit:closed', events.lm.ruleCircuitClosed(), (data) => {
  const d = data as NAREventMap['system:lm.rule:circuit:closed'];
  return mint('system_lm_rule.circuit_closed', {
    engine: 'nar',
    payload: { ruleId: d.ruleId, ruleName: d.ruleName, timestamp: d.timestamp },
  });
});

// Cognition events
addHandler(handlers, 'rule:applied', events.cognition.ruleApplied(), (data) => {
  const d = data as NAREventMap['rule:applied'];
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
  const d = data as NAREventMap['derivation:accepted'];
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
  const d = data as NAREventMap['derivation:record'];
  return mint('derivation.record', { engine: 'nar', payload: d });
});

addHandler(handlers, 'concept:created', events.cognition.conceptCreated(), (data) => {
  const d = data as NAREventMap['concept:created'];
  return mint('concept.activated', {
    engine: 'nar',
    payload: { term: String(d.term), priority: d.priority },
  });
});

addHandler(handlers, 'concept:removed', events.cognition.conceptRemoved(), (data) => {
  const d = data as NAREventMap['concept:removed'];
  return mint('belief.retracted', {
    engine: 'nar',
    payload: { term: String(d.term) },
  });
});

addHandler(handlers, 'cognitive:state-change', events.cognition.stateChange(), (data) => {
  const d = data as NAREventMap['cognitive:state-change'];
  return mint('drive.changed', {
    engine: 'nar',
    payload: { drive: `cognitive:${d.action}`, urgency: 0.5 },
  });
});

// Tool events
addHandler(handlers, 'tool:call', events.tool.call(), (data) => {
  const d = data as NAREventMap['tool:call'];
  return mint('tool.request', {
    engine: 'nar',
    timestamp: d.timestamp,
    payload: { toolName: d.name, args: d.args as Record<string, unknown> },
  });
});

addHandler(handlers, 'tool:result', events.tool.result(), (data) => {
  const d = data as NAREventMap['tool:result'];
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
  const d = data as NAREventMap['tool:error'];
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
addHandler(handlers, 'lm:start', events.system.lmStart(), (_data) =>
  mint('skill.executed', {
    engine: 'nar',
    payload: { skill: 'lm.generate', args: [], result: '', durationMs: 0 },
  })
);

export function narEventToCognitive(
  event: keyof NAREventMap,
  data: NAREventMap[keyof NAREventMap]
): CognitiveEvent | null {
  const handler = handlers.get(event as string);
  if (!handler) return null;
  return handler(data);
}

/** All NAR event keys that have a CognitiveEvent mapping. */
export const MAPPED_NAR_EVENTS: Array<keyof NAREventMap> = [...handlers.keys()] as Array<keyof NAREventMap>;