import type {LMClient, LMConfig} from './types.js';
import {errMsg} from '../utils/helpers.js';

type CallLogEntry = {prompt: string; response: string; duration: number};

export abstract class BaseLMClient implements LMClient {
    protected callLog: CallLogEntry[] = [];

    async generateText(prompt: string, options?: LMConfig): Promise<string> {
        const startTime = Date.now();
        try {
            const response = await this.executeGenerate(prompt, options);
            this.logCall(prompt, response, Date.now() - startTime);
            return response;
        } catch (error) {
            this.handleError(error, prompt, startTime);
            throw error;
        }
    }

    protected abstract executeGenerate(prompt: string, options?: LMConfig): Promise<string>;

    protected logCall(prompt: string, response: string, duration: number): void {
        this.callLog.push({prompt, response, duration});
    }

protected handleError(error: unknown, prompt: string, startTime: number): never {
const duration = Date.now() - startTime;
this.callLog.push({
prompt,
response: `ERROR: ${errMsg(error)}`,
duration,
});
throw error;
}

    getCallLog(): CallLogEntry[] {
        return [...this.callLog];
    }

    getLastCall(): CallLogEntry | null {
        return this.callLog[this.callLog.length - 1] ?? null;
    }

    getCallCount(): number {
        return this.callLog.length;
    }

    clearLog(): void {
        this.callLog = [];
    }
}
