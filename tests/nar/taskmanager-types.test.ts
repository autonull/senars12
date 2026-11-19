import { isEventType, type TaskAdmittedEvent } from '@senars/agent';
import { describe, expect, it } from 'vitest';
import { createGateRegistry } from '@senars/kernel/GateRegistry';
import { Memory } from '@senars/memory/memory';
import { TaskManager } from '@senars/task/manager';
import { Truth, termParser } from '@senars/terms/index';
import { createTask, NEUTRAL_BUDGET } from '@senars/types/core';

describe('todo7: taskmanager preserves task types', () => {
  it('goals/questions admitted as such, not beliefs', async () => {
    const memory = new Memory({ maxConcepts: 100 } as never);
    const registry = createGateRegistry();
    const manager = new TaskManager(memory, { gateRegistry: registry });
    manager.addTask(
      createTask(termParser.parse('(a-->b)'), 'belief', Truth.create(0.9, 0.8), NEUTRAL_BUDGET)
    );
    manager.addTask(
      createTask(termParser.parse('(a-->b)'), 'goal', Truth.create(0.9, 0.8), NEUTRAL_BUDGET)
    );
    manager.addTask(
      createTask(termParser.parse('(a-->?)'), 'question', Truth.create(0.5, 0.5), NEUTRAL_BUDGET)
    );
    const processed = await manager.processPending();
    expect(processed.map((t) => t.type).sort()).toEqual(['belief', 'goal', 'question']);
    const admitted = registry
      .getPerceptionGate()
      .getEventLog()
      .filter(isEventType('task.admitted'))
      .map((e: TaskAdmittedEvent) => e.payload.taskType)
      .sort();
    expect(admitted).toEqual(['belief', 'goal', 'question']);
  });
});
