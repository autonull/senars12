export const IntrospectionEvents = Object.freeze({
    // System Lifecycle
    SYSTEM_START: 'system:start',
    SYSTEM_STOP: 'system:stop',

    // Reasoning Cycle
    CYCLE_START: 'cycle:start',
    CYCLE_END: 'cycle:end',
    CYCLE_STEP: 'cycle:step',

    // Memory
    MEMORY_CONCEPT_CREATED: 'memory:concept:created',
    MEMORY_CONCEPT_ACCESSED: 'memory:concept:accessed',
    MEMORY_TASK_ADDED: 'memory:task:added',
    MEMORY_CONSOLIDATION_START: 'memory:consolidation:start',
    MEMORY_CONSOLIDATION_END: 'memory:consolidation:end',
    MEMORY_FOCUS_PROMOTE: 'memory:focus:promote',
    MEMORY_FOCUS_DEMOTE: 'memory:focus:demote',

    // TermFactory
    TERM_CREATED: 'term:created',
    TERM_CACHE_HIT: 'term:cache:hit',
    TERM_CACHE_MISS: 'term:cache:miss',

    // Rule Engine
    RULE_FIRED: 'rule:fired',
    RULE_NOT_FIRED: 'rule:not_fired',

    // Reasoning
    REASONING_DERIVATION: 'reasoning:derivation',
    REASONING_DERIVATION_CHAIN: 'reasoning:derivation:chain',
    REASONING_GOAL_ACHIEVED: 'reasoning:goal:achieved',

    // Task
    TASK_INPUT: 'task:input',
    TASK_ADDED: 'task:added',
    TASK_FOCUS: 'task:focus',
    TASK_ERROR: 'task:error',

    // LM
    LM_PROMPT_START: 'lm:prompt:start',
    LM_PROMPT_COMPLETE: 'lm:prompt:complete',
    LM_ERROR: 'lm:error',

    // Metacognition
    META_PATTERN_DETECTED: 'meta:pattern:detected',
    META_SELF_OPTIMIZATION: 'meta:self_optimization',

    // System States
    SYSTEM_LOADED: 'system:loaded',
    SYSTEM_RESET: 'system:reset',
});

export const createEventPayload = (sourceComponent, payload) => ({
    timestamp: Date.now(),
    sourceComponent,
    payload,
});
