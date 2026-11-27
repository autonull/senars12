/** The episode vocabulary — one declaration, so the type and the Zod enum cannot drift. */
export const EPISODE_TYPES = [
    'input',
    'response',
    'belief_added',
    'question',
    'tool_call',
    'error',
    'dialogue',
    'reaction',
];
