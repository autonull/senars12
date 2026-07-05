export class ExecutionHistory {
    constructor(maxHistorySize = 1000) {
        this.maxHistorySize = maxHistorySize;
        this.history = [];
    }

    add(execution) {
        this.history.push({...execution, timestamp: Date.now()});
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    get(options = {}, tools) {
        let {history} = this;
        if (options.toolName) {
            history = history.filter(e => e.toolId === options.toolName);
        }
        if (options.category) {
            history = history.filter(e => tools.get(e.toolId)?.category === options.category);
        }
        if (options.limit) {
            history = history.slice(-options.limit);
        }
        return [...history];
    }
}
