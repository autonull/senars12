import { type CognitiveEvent } from '@senars/schemas/cognitive-events';
import type { NAREventMap } from '../types/events';
export declare function narEventToCognitive(event: keyof NAREventMap, data: NAREventMap[keyof NAREventMap]): CognitiveEvent | null;
/** All NAR event keys that have a CognitiveEvent mapping. */
export declare const MAPPED_NAR_EVENTS: Array<keyof NAREventMap>;
//# sourceMappingURL=bridge.d.ts.map