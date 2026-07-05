/**
 * Constants for the SeNARS UI application
 */

export const UI_CONSTANTS = {
    // Log types
    LOG_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info',
        DEBUG: 'debug',
        INPUT: 'input',
        TASK: 'task',
        CONCEPT: 'concept',
        QUESTION: 'question',
        REASONING: 'reasoning',
        CONNECTION: 'connection',
        SNAPSHOT: 'snapshot',
        CONTROL: 'control',
        NOTIFICATION: 'notification',
        COMMAND: 'command',
        DEMO: 'demo',
        REFRESH: 'refresh',
        CLEAR: 'clear',
        EVENT_BATCH: 'eventBatch'
    },

    // Log icons
    LOG_ICONS: {
        SUCCESS: '✅',
        ERROR: '❌',
        WARNING: '⚠️',
        INFO: 'ℹ️',
        DEBUG: '🔍',
        INPUT: '⌨️',
        TASK: '📥',
        CONCEPT: '🧠',
        QUESTION: '❓',
        REASONING: '🔍',
        CONNECTION: '🌐',
        SNAPSHOT: '📊',
        CONTROL: '⚙️',
        NOTIFICATION: '🔔',
        COMMAND: '📜',
        DEMO: '🎬',
        REFRESH: '🔄',
        CLEAR: '🧹',
        EVENT_BATCH: '📦'
    },

    // Message types
    MESSAGE_TYPES: {
        NARSESE_RESULT: 'narsese.result',
        NARSESE_ERROR: 'narsese.error',
        TASK_ADDED: 'task.added',
        TASK_INPUT: 'task.input',
        CONCEPT_CREATED: 'concept.created',
        CONCEPT_UPDATED: 'concept.updated',
        CONCEPT_ADDED: 'concept.added',
        QUESTION_ANSWERED: 'question.answered',
        REASONING_DERIVATION: 'reasoning.derivation',
        REASONING_STEP: 'reasoning.step',
        ERROR: 'error',
        ERROR_MESSAGE: 'error.message',
        CONNECTION: 'connection',
        MEMORY_SNAPSHOT: 'memorySnapshot',
        INFO: 'info',
        LOG: 'log',
        CONTROL_RESULT: 'control.result',
        CYCLE_START: 'cycle.start',
        CYCLE_COMPLETE: 'cycle.complete'
    },

    // Node types
    NODE_TYPES: {
        CONCEPT: 'concept',
        TASK: 'task',
        QUESTION: 'question'
    },

    // Edge types
    EDGE_TYPES: {
        RELATIONSHIP: 'relationship'
    },

    // Graph layout names
    LAYOUT_NAMES: {
        COSE: 'cose'
    }
};