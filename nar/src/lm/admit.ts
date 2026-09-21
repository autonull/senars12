import { type GateRegistry, gateRegistry } from '../kernel/index.js';
import type { Memory } from '../memory';
import type { Task } from '../types';
import { shadowValidator } from './shadow-validation.js';

export async function admitTasks(
  memory: Memory,
  tasks: Task[],
  source: string,
  gates: GateRegistry = gateRegistry
): Promise<number> {
  // Shadow validation (3.3): LLM-originated tasks must not contradict current beliefs.
  const shadow = source.includes('llm');
  const beliefs = shadow ? memory.listConcepts().flatMap((c) => c.getBeliefs()) : [];
  let admitted = 0;
  for (const task of tasks) {
    if (!gates.getPerceptionGate().admitTask(task.term, task.type, task.truth, source).admitted)
      continue;
    if (shadow && !(await shadowValidator.validateWithHead(task, beliefs))) continue;
    memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
    admitted++;
  }
  return admitted;
}
