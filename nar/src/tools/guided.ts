import type {Memory} from '../memory';
import {termParser, Truth} from '../terms';
import {createBudget} from '../types';
import type {ToolManager} from './tool-registry';
import {gateRegistry} from '../kernel/index.js';

export class ToolGuidedReasoning {
    constructor(
        private memory: Memory,
        private toolManager: ToolManager
    ) {
        // Event handling via EventBus would go here if needed
    }

    async executeToolAndReason(toolName: string, args: Record<string, unknown>): Promise<boolean> {
        try {
            const result = await this.toolManager.execute(toolName, args);
            return result.success;
        } catch (e) {
            console.error(`Tool execution failed: ${toolName}`, e);
            return false;
        }
    }

    private handleToolResult(event: any): void {
        if (event.result?.success) {
            const belief = `(TOOL_RESULT_${event.name} --> ${JSON.stringify(event.result.content)})`;
            try {
                const term = termParser.parse(belief);
                if (!gateRegistry.getPerceptionGate().admitTask(term, 'belief', Truth.NEUTRAL, 'tool').admitted) return;
                this.memory.addTask(term, 'belief', Truth.NEUTRAL, createBudget(0.5));
            } catch {
                const atomTerm = termParser.parse(`tool_result_${event.name}`);
                if (!gateRegistry.getPerceptionGate().admitTask(atomTerm, 'belief', Truth.NEUTRAL, 'tool').admitted) return;
                this.memory.addTask(atomTerm, 'belief', Truth.NEUTRAL, createBudget(0.5));
            }
        }
    }
}
