import {gateRegistry} from '../kernel/index.js';
import type {Memory} from '../memory';
import type {Task} from '../types';

export function admitTasks(memory: Memory, tasks: Task[], source: string): number {
    let admitted = 0;
    for (const task of tasks) {
        if (!gateRegistry.getPerceptionGate().admitTask(task.term, task.type, task.truth, source).admitted)
            continue;
        memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        admitted++;
    }
    return admitted;
}
