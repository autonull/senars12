// Task types and creators
export type { Budget, Task, TaskType } from '../types/core';
export { createTaskWeight, createTask } from '../types/core';
export type { InputProcessorConfig } from './input';

// Task input handling
export { InputProcessor, inputProcessor } from './input';
// Task persistence boundary
export {
  PUNCTUATION_BY_TASK_TYPE,
  rehydrateTask,
  serializeTaskRecord,
  type TaskRecord,
  taskTypeFromPunctuation,
} from './record';
// Task management
export { TaskManager } from './manager';
// Task classification
export { classifyTask, classifyTaskSignals, type TaskSignal } from './classify';
