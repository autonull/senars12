import { describe, expect, it } from 'vitest';
import { TaskManager } from '../../nar/src/task/manager.js';
import { Memory } from '../../nar/src/memory/memory.js';
import { termParser, Truth } from '../../nar/src/terms/index.js';
import { createTask, NEUTRAL_BUDGET } from '../../nar/src/types/core.js';
import { gateRegistry } from '../../nar/src/kernel/GateRegistry.js';

describe('todo7: taskmanager preserves task types', () => {
  it('goals/questions admitted as such, not beliefs', async () => {
    gateRegistry.reset();
    const memory = new Memory({ maxConcepts: 100 } as never);
    const manager = new TaskManager(memory);
    manager.addTask(createTask(termParser.parse('(a --> b)'), 'belief', Truth.create(0.9, 0.8), NEUTRAL_BUDGET));
    manager.addTask(createTask(termParser.parse('(a --> b)'), 'goal', Truth.create(0.9, 0.8), NEUTRAL_BUDGET));
    manager.addTask(createTask(termParser.parse('(a --> ?)'), 'question', Truth.create(0.5, 0.5), NEUTRAL_BUDGET));
    const processed = await manager.processPending();
    expect(processed.map((t) => t.type).sort()).toEqual(['belief', 'goal', 'question']);
    const admitted = gateRegistry.getPerceptionGate().getEventLog().map((e) => e.payload.taskType).sort();
    expect(admitted).toEqual(['belief', 'goal', 'question']);
    gateRegistry.reset();
  });
});
