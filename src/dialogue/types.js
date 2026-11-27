import { keyedBy } from '@senars/util/collections';
export const REACTION_KINDS = [
    'accept',
    'correct',
    'reject',
    'clarify',
    'redirect',
    'abandon',
];
export const emptyReactionDistribution = () => keyedBy(REACTION_KINDS, (kind) => kind, () => 0);
