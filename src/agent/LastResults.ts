export interface LastResultsEntry {
    turn: number;
    input: string;
    response: string;
    actions: string[];
}

export class LastResults {
    private history: LastResultsEntry[] = [];
    private turn = 0;

    record(input: string, response: string, actions: string[] = []): void {
        this.history.push({
            turn: this.turn++,
            input,
            response,
            actions,
        });
        if (this.history.length > 20) {
            this.history.shift();
        }
    }

    getRecent(n: number): string {
        const entries = this.history.slice(-n);
        if (entries.length === 0) return '';
        return entries.map(e =>
            `Turn ${e.turn}: INPUT: ${e.input} | RESPONSE: ${e.response}${e.actions.length > 0 ? ` | ACTIONS: ${e.actions.join(', ')}` : ''}`
        ).join('\n');
    }

    clear(): void {
        this.history = [];
        this.turn = 0;
    }

    getHistory(): LastResultsEntry[] {
        return [...this.history];
    }
}