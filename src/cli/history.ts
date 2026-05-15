/**
 * Command history management
 */
import {existsSync, promises as fs} from 'fs';
import {errMsg} from '../nar/utils/index.js';

const HISTFILE = process.env.SENARS_HISTFILE || '/tmp/senars_history';
const MAX_HISTORY = 1000;

export class HistoryManager {
    private history: string[] = [];
    private index = -1;

    constructor() {
        this.loadHistory();
    }

    async loadHistory(): Promise<void> {
        try {
            if (existsSync(HISTFILE)) {
                const content = await fs.readFile(HISTFILE, 'utf-8');
                this.history = content.split('\n').filter(line => line.trim()).slice(-MAX_HISTORY);
                this.index = this.history.length;
            }
        } catch (e) { console.error('Failed to load history:', e); this.history = []; this.index = 0; }
    }

    async saveHistory(): Promise<void> {
        try {
            await fs.writeFile(HISTFILE, this.history.join('\n'), 'utf-8');
        } catch (error) {
            console.error('Failed to save history:', errMsg(error));
        }
    }

    add(input: string): void {
        if (this.history[this.history.length - 1] !== input) {
            this.history.push(input);
            if (this.history.length > MAX_HISTORY) {
                this.history.shift();
            }
        }
        this.index = this.history.length;
    }

}
