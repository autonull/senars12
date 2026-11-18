// Task types and creators
export type { Budget, Task, TaskType } from '../types/core.js';
export { createTaskWeight, createTask } from '../types/core.js';
export type { InputProcessorConfig } from './input.js';

// Task input handling
export { InputProcessor, inputProcessor } from './input.js';
// Task persistence boundary
export {
  PUNCTUATION_BY_TASK_TYPE,
  rehydrateTask,
  serializeTaskRecord,
  type TaskRecord,
  taskTypeFromPunctuation,
} from './record.js';
// Task management
export { TaskManager } from './manager.js';
// Task classification
export { classifyTask, classifyTaskSignals, type TaskSignal } from './classify.js';
