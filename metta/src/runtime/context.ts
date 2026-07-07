import { Effect } from 'effect';
import type { MeTTaAtom } from '../types/ast.js';

export interface MeTTaContext {
  readonly maxSteps: number;
  readonly timeout: number;
  readonly memoryLimit: number;
}