import { KernelActionGate } from './KernelActionGate';
import { KernelBudgetGate } from './KernelBudgetGate';
import { KernelPerceptionGate } from './KernelPerceptionGate';
import { KernelRewardGate } from './KernelRewardGate';
export class GateRegistry {
    gates;
    initialized = false;
    constructor() {
        this.gates = this.construct();
    }
    /**
     * The one place a gate exists. Construction, configuration and `reset` each used
     * to spell the same four lines, so a fifth gate meant three edits and a reset
     * could leave one of them behind.
     */
    construct(config) {
        return {
            perception: new KernelPerceptionGate(config?.perceptionConfig),
            action: new KernelActionGate(config?.actionConfig),
            reward: new KernelRewardGate(config?.rewardConfig),
            budget: new KernelBudgetGate(config?.budgetConfig),
        };
    }
    /** Phase E (REFACTOR.todo1): attach source reputation to the perception gate. */
    setReputation(reputation) {
        this.gates.perception.setReputation(reputation);
    }
    getPerceptionGate() {
        return this.gates.perception;
    }
    getActionGate() {
        return this.gates.action;
    }
    getRewardGate() {
        return this.gates.reward;
    }
    getBudgetGate() {
        return this.gates.budget;
    }
    initialize(config) {
        if (this.initialized)
            return;
        this.gates = this.construct(config);
        if (config?.initialBudget) {
            this.gates.budget.setBudget(config.initialBudget);
        }
        if (config?.initialAutonomyMode) {
            this.gates.action.setAutonomyMode(config.initialAutonomyMode);
        }
        this.initialized = true;
    }
    isInitialized() {
        return this.initialized;
    }
    reset() {
        this.gates = this.construct();
        this.initialized = false;
    }
    getAllEventLogs() {
        const { perception, action, reward, budget } = this.gates;
        return {
            perception: perception.getEventLog(),
            action: action.getEventLog(),
            autonomy: action.getAutonomyLog(),
            reward: reward.getEventLog(),
            budget: budget.getEventLog(),
        };
    }
    /**
     * Route a persisted gate log back into the rings it came from (CORE.19 C4.3).
     * The autonomy ring is a state-transition log, so the mode it ends at is
     * restored with it — the one piece of gate state the log implies, so the log
     * and the gate cannot disagree after a restart.
     */
    restoreEventLogs(entries) {
        const { perception, action, reward, budget } = this.gates;
        let mode;
        let restored = 0;
        for (const { gate, event } of entries) {
            if (gate === 'autonomy') {
                const change = event;
                action.restoreAutonomyEvent(change);
                mode = change.payload.newMode;
            }
            else if (gate === 'perception')
                perception.restoreEvent(event);
            else if (gate === 'action')
                action.restoreEvent(event);
            else if (gate === 'reward')
                reward.restoreEvent(event);
            else
                budget.restoreEvent(event);
            restored++;
        }
        if (mode)
            action.setAutonomyMode(mode);
        return restored;
    }
    clearAllEventLogs() {
        for (const gate of Object.values(this.gates))
            gate.clearEventLog();
    }
}
/** The only way to obtain gates (TODO19 F2, TODO33 §5.P2.7). There is no process-global registry: a singleton with a `reset()` that existed solely for test isolation let a NAR with an isolated registry share the global's budget and autonomy mode with any separately-built `Focus`. Every consumer is handed one. */
export const createGateRegistry = () => new GateRegistry();
