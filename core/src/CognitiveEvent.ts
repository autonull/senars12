/**
 * Re-export of the canonical cognitive event/chat types owned by `@senars/util`.
 * Kept as a module path for existing internal imports; declarations live in one place.
 */
export type {
  ChatOptions,
  ChatStreamEvent,
  CognitiveEvent,
  CognitiveEventBase,
  EngineOrigin,
} from '@senars/util/types/cognitive';
export { isEventType, isNarEvent } from '@senars/util/types/cognitive';
