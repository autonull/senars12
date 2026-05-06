import type { Task } from '../../task/task.js';
import { Memory } from '../../memory/memory.js';
import type { Strategy } from '../strategy.js';

export const PrologStrategy: Strategy = {
    name: 'prolog',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(20);
        
        for (const concept of concepts) {
            if (concept.term.hash === task.term.hash) continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
            
            if (results.length >= 5) break;
        }
        
        return results;
    }
};

export const ResolutionStrategy: Strategy = {
    name: 'resolution',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(15);
        
        for (const concept of concepts) {
            if (concept.term.kind !== 'inheritance') continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
        }
        
        return results;
    }
};

export const GoalDrivenStrategy: Strategy = {
    name: 'goal-driven',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(20);
        
        for (const concept of concepts) {
            if (concept.term.hash === task.term.hash) continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            const truth = (belief as any).truth;
            if (truth && truth.f > 0.7) {
                results.push({
                    term: concept.term,
                    type: 'belief' as const,
                    truth: truth,
                    budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                    stamp: Object.freeze({
                        id: '',
                        creationTime: 0,
                        source: 'INPUT' as const,
                        derivations: [] as readonly string[],
                        depth: 0
                    }),
                    occurrenceTime: 0,
                    derived: false
                });
            }
            
            if (results.length >= 5) break;
        }
        
        return results;
    }
};

export const AnalogicalStrategy: Strategy = {
    name: 'analogical',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(15);
        
        for (const concept of concepts) {
            if (concept.term.kind !== 'inheritance') continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
            
            if (results.length >= 3) break;
        }
        
        return results;
    }
};

export const TermLinkStrategy: Strategy = {
    name: 'term-link',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(25);
        const taskHash = task.term.hash;
        
        for (const concept of concepts) {
            if (concept.term.hash === taskHash) continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
            
            if (results.length >= 10) break;
        }
        
        return results;
    }
};

export const TaskMatchStrategy: Strategy = {
    name: 'task-match',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(20);
        
        for (const concept of concepts) {
            if (concept.term.hash === task.term.hash) continue;
            
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: task.type as any,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
            
            if (results.length >= 5) break;
        }
        
        return results;
    }
};

export const DecompositionStrategy: Strategy = {
    name: 'decomposition',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        
        if (task.term.kind === 'conjunction') {
            for (const arg of task.term.args) {
                const concept = memory.getConcept(arg);
                if (!concept) continue;
                
                const belief = concept.beliefBag.peek();
                if (!belief) continue;
                
                results.push({
                    term: arg,
                    type: 'belief' as const,
                    truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                    budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                    stamp: Object.freeze({
                        id: '',
                        creationTime: 0,
                        source: 'INPUT' as const,
                        derivations: [] as readonly string[],
                        depth: 0
                    }),
                    occurrenceTime: 0,
                    derived: false
                });
            }
        }
        
        return results;
    }
};

export const DefaultFormationStrategy: Strategy = {
    name: 'default-formation',
    selectSecondary(task: Task, memory: Memory): Task[] {
        const results: Task[] = [];
        const concepts = memory.sample(10);
        
        for (const concept of concepts) {
            const belief = concept.beliefBag.peek();
            if (!belief) continue;
            
            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: (belief as any).truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [] as readonly string[],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });
        }
        
        return results;
    }
};
