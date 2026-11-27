/**
 * Canonical Event Taxonomy — standardized event names and payloads.
 *
 * This is the single source of truth for all event types in the system.
 * All event emission sites should use these canonical names and shapes.
 */
/** Event channel prefixes. */
export const EventChannel = {
    kernel: 'kernel',
    cognition: 'cognition',
    ui: 'ui',
    loop: 'loop',
    mining: 'mining',
    telemetry: 'telemetry',
    agent: 'agent',
    tool: 'tool',
    nl: 'nl',
    autonomy: 'autonomy',
    lm: 'lm',
    system: 'system',
};
/** Build a canonical event name: `channel:name`. */
export function eventName(channel, name) {
    return `${channel}:${name}`;
}
/** Event catalog for documentation generation. */
export const EVENT_CATALOG = {
    // Kernel
    'kernel:budget:slice:created': { channel: 'kernel', description: 'Budget slice created' },
    'kernel:budget:slice:consumed': { channel: 'kernel', description: 'Budget slice consumed' },
    'kernel:budget:slice:exhausted': { channel: 'kernel', description: 'Budget slice exhausted' },
    'kernel:budget:slice:merged': { channel: 'kernel', description: 'Budget slice merged' },
    'kernel:cognitive': { channel: 'kernel', description: 'Cognitive event from kernel gates' },
    'kernel:memory:pressure': { channel: 'kernel', description: 'Memory pressure event' },
    'kernel:memory:consolidated': { channel: 'kernel', description: 'Memory consolidated event' },
    'kernel:lm:call': { channel: 'kernel', description: 'LM call event' },
    'kernel:lm:error': { channel: 'kernel', description: 'LM error event' },
    'kernel:cycle:state': { channel: 'kernel', description: 'Kernel cycle state' },
    'kernel:error': { channel: 'kernel', description: 'Error event' },
    'kernel:restore:state': { channel: 'kernel', description: 'Restore state event' },
    'kernel:cycle:rewound': { channel: 'kernel', description: 'Cycle rewound event' },
    // Cognition
    'cognition:contradiction': { channel: 'cognition', description: 'Contradiction detected' },
    'cognition:rule:applied': { channel: 'cognition', description: 'Rule applied' },
    'cognition:concept:created': { channel: 'cognition', description: 'Concept created' },
    'cognition:concept:removed': { channel: 'cognition', description: 'Concept removed' },
    'cognition:derivation:accepted': { channel: 'cognition', description: 'Derivation accepted' },
    'cognition:derivation:record': { channel: 'cognition', description: 'Derivation record' },
    'cognition:nar:derivation': { channel: 'cognition', description: 'NAR derivation' },
    'cognition:state-change': { channel: 'cognition', description: 'Cognitive state change' },
    'cognition:explanation': { channel: 'cognition', description: 'Explanation event' },
    'cognition:nal:derived': { channel: 'cognition', description: 'NAL derived' },
    'cognition:lm:validation-failed': { channel: 'cognition', description: 'LM validation failed' },
    'cognition:feedback:correction': { channel: 'cognition', description: 'Feedback correction' },
    // Loop
    'loop:iteration_start': { channel: 'loop', description: 'Iteration started' },
    'loop:iteration_complete': { channel: 'loop', description: 'Iteration completed' },
    'loop:iteration_failed': { channel: 'loop', description: 'Iteration failed' },
    'loop:selection_made': { channel: 'loop', description: 'Selection made' },
    'loop:action_executed': { channel: 'loop', description: 'Action executed' },
    'loop:judgment_complete': { channel: 'loop', description: 'Judgment complete' },
    'loop:contract_checked': { channel: 'loop', description: 'Contract checked' },
    'loop:repair_complete': { channel: 'loop', description: 'Repair complete' },
    'loop:appraisal_complete': { channel: 'loop', description: 'Appraisal complete' },
    'loop:max_iterations_reached': { channel: 'loop', description: 'Max iterations reached' },
    'loop:timeout': { channel: 'loop', description: 'Timeout' },
    // Mining
    'mining:schema_induced': { channel: 'mining', description: 'Schema induced' },
    'mining:surprise': { channel: 'mining', description: 'Surprise detected' },
    'mining:domain_learned': { channel: 'mining', description: 'Domain learned' },
    'mining:pattern_found': { channel: 'mining', description: 'Pattern found' },
    // Telemetry
    'telemetry:event': { channel: 'telemetry', description: 'Telemetry event' },
    // Agent
    'agent:process:start': { channel: 'agent', description: 'Process started' },
    'agent:process:complete': { channel: 'agent', description: 'Process completed' },
    'agent:suspend': { channel: 'agent', description: 'Agent suspended' },
    'agent:resume': { channel: 'agent', description: 'Agent resumed' },
    // Tool
    'tool:register': { channel: 'tool', description: 'Tool registered' },
    'tool:unregister': { channel: 'tool', description: 'Tool unregistered' },
    'tool:init': { channel: 'tool', description: 'Tool initialized' },
    'tool:stop': { channel: 'tool', description: 'Tool stopped' },
    'tool:dispose': { channel: 'tool', description: 'Tool disposed' },
    'tool:call': { channel: 'tool', description: 'Tool called' },
    'tool:result': { channel: 'tool', description: 'Tool result' },
    'tool:error': { channel: 'tool', description: 'Tool error' },
    // NL
    'nl:analyzed': { channel: 'nl', description: 'NL analyzed' },
    'nl:translation': { channel: 'nl', description: 'NL translation' },
    'nl:clarification-needed': { channel: 'nl', description: 'Clarification needed' },
    // Autonomy
    'autonomy:curiosity': { channel: 'autonomy', description: 'Curiosity triggered' },
    'autonomy:consolidated': { channel: 'autonomy', description: 'Consolidated' },
    'autonomy:budget': { channel: 'autonomy', description: 'Budget exhausted' },
    // LM
    'lm:rule:applied': { channel: 'lm', description: 'LM rule applied' },
    'lm:rule:skipped': { channel: 'lm', description: 'LM rule skipped' },
    'lm:rule:structured': { channel: 'lm', description: 'LM rule structured output' },
    'lm:rule:tool:called': { channel: 'lm', description: 'LM rule tool called' },
    'lm:rule:tool:result': { channel: 'lm', description: 'LM rule tool result' },
    'lm:rule:failed': { channel: 'lm', description: 'LM rule failed' },
    'lm:rule:circuit:open': { channel: 'lm', description: 'LM rule circuit open' },
    'lm:rule:circuit:half-open': { channel: 'lm', description: 'LM rule circuit half-open' },
    'lm:rule:circuit:closed': { channel: 'lm', description: 'LM rule circuit closed' },
    // System
    'system:turn:start': { channel: 'system', description: 'Pipeline turn start' },
    'system:turn:end': { channel: 'system', description: 'Pipeline turn end' },
    'system:turn:error': { channel: 'system', description: 'Pipeline turn error' },
    'system:stage:start': { channel: 'system', description: 'Pipeline stage start' },
    'system:stage:end': { channel: 'system', description: 'Pipeline stage end' },
    'system:stage:error': { channel: 'system', description: 'Pipeline stage error' },
    'system:classify:result': { channel: 'system', description: 'Classify result' },
    'system:trigger:score': { channel: 'system', description: 'Trigger score' },
    'system:reasoning:start': { channel: 'system', description: 'Reasoning start' },
    'system:reasoning:end': { channel: 'system', description: 'Reasoning end' },
    'system:lm:start': { channel: 'system', description: 'LM start' },
    'system:lm:chunk': { channel: 'system', description: 'LM chunk' },
    'system:lm:end': { channel: 'system', description: 'LM end' },
    'system:lm:suggests-reasoning': { channel: 'system', description: 'LM suggests reasoning' },
    'system:lm-rule:executed': { channel: 'system', description: 'LM rule executed' },
    'system:lm-rule:failed': { channel: 'system', description: 'LM rule failed' },
    'system:lm-rule:disabled': { channel: 'system', description: 'LM rule disabled' },
    'system:directive:found': { channel: 'system', description: 'Directive found' },
    'system:directive:execute': { channel: 'system', description: 'Directive execute' },
    'system:directive:loop-requested': { channel: 'system', description: 'Directive loop requested' },
    'system:loop:pass': { channel: 'system', description: 'Loop pass' },
    'system:conversation:message-added': { channel: 'system', description: 'Conversation message added' },
    'system:conversation:artifact-added': { channel: 'system', description: 'Conversation artifact added' },
    'system:conversation:belief-pinned': { channel: 'system', description: 'Conversation belief pinned' },
    'system:conversation:summarized': { channel: 'system', description: 'Conversation summarized' },
};
