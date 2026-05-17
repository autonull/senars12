export type LMStatus = 'available' | 'degraded' | 'unavailable';

export class DegradationManager {
    private readonly fallbackResponses: Map<string, string> = new Map([
        ['greeting', 'Hello! I\'m here and ready to help.'],
        ['query', 'I\'m currently operating in a degraded mode. Please try again shortly.'],
        ['belief', 'Noted. I\'ll process that information shortly.'],
        ['default', 'I\'m processing your request. Please stand by.'],
    ]);
    private lmStatus: LMStatus = 'available';
    private lastCheck = 0;
    private readonly checkIntervalMs = 30000;

    checkLMHealth(): LMStatus {
        if (Date.now() - this.lastCheck < this.checkIntervalMs) {
            return this.lmStatus;
        }
        return this.lmStatus;
    }

    setLMStatus(status: LMStatus): void {
        this.lmStatus = status;
        this.lastCheck = Date.now();
    }

    getFallbackResponse(input: string): string | null {
        const lower = input.toLowerCase();
        if (lower.includes('hello') || lower.includes('hi')) {
            return this.fallbackResponses.get('greeting') ?? null;
        }
        if (lower.includes('?')) {
            return this.fallbackResponses.get('query') ?? null;
        }
        if (lower.endsWith('.')) {
            return this.fallbackResponses.get('belief') ?? null;
        }
        return this.fallbackResponses.get('default') ?? null;
    }

    shouldUseFallback(): boolean {
        return this.lmStatus !== 'available';
    }

    reportStatus(): string {
        return `LM Status: ${this.lmStatus}`;
    }
}