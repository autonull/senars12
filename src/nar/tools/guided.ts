import type {ToolManager} from './manager';
import type {Memory} from '../memory';
import {termParser, Truth} from '../terms';
import {createBudget} from '../types';

export class ToolGuidedReasoning {
    constructor(
        private memory: Memory,
        private toolManager: ToolManager
    ) {
        this.toolManager.on('tool:result', (event) => {
            this.handleToolResult(event);
        });
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
                this.memory.addTask(term, 'belief', Truth.NEUTRAL, createBudget(0.5)); // system boundary — tool result has no truth
            } catch {
                const atomTerm = termParser.parse(`tool_result_${event.name}`);
                this.memory.addTask(atomTerm, 'belief', Truth.NEUTRAL, createBudget(0.5)); // system boundary — tool result has no truth
            }
        }
    }
}
