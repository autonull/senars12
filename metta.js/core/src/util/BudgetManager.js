/**
 * Resource budget management utility with enhanced tracking and validation
 */
export class BudgetManager {
    constructor(configOrBudget = 1000) {
        let initialBudget = 1000;
        let config = {};

        if (typeof configOrBudget === 'number') {
            initialBudget = configOrBudget;
        } else if (typeof configOrBudget === 'object') {
            initialBudget = configOrBudget.total ?? 1000;
            config = configOrBudget;
        }

        if (initialBudget < 0) {
            throw new Error('Initial budget cannot be negative');
        }

        this.budget = initialBudget;
        this.config = config;
        this.allocations = new Map();
        this.history = []; // Track allocation history
    }

    allocate(id, amount) {
        // Validate inputs
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('Allocation ID must be a non-empty string');
        }

        if (amount < 0) {
            throw new Error('Allocation amount cannot be negative');
        }

        if (this.budget < amount) {
            return false;
        }

        this.budget -= amount;
        const currentAllocation = this.allocations.get(id) || 0;
        this.allocations.set(id, currentAllocation + amount);

        // Record in history
        this.history.push({
            type: 'allocate',
            id,
            amount,
            timestamp: Date.now(),
            available: this.budget,
            allocated: currentAllocation + amount
        });

        return true;
    }

    release(id) {
        // Validate input
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('Allocation ID must be a non-empty string');
        }

        const amount = this.allocations.get(id) || 0;
        if (amount === 0) {
            return 0; // Nothing to release
        }

        this.budget += amount;
        this.allocations.delete(id);

        // Record in history
        this.history.push({
            type: 'release',
            id,
            amount,
            timestamp: Date.now(),
            available: this.budget,
            allocated: 0
        });

        return amount;
    }

    getAvailable() {
        return this.budget;
    }

    getTotalAllocated() {
        return Array.from(this.allocations.values()).reduce((sum, val) => sum + val, 0);
    }

    getAllocation(id) {
        return this.allocations.get(id) || 0;
    }

    hasBudget(amount) {
        return this.budget >= amount;
    }

    utilization() {
        const allocated = this.getTotalAllocated();
        const total = allocated + this.budget;
        return total > 0 ? allocated / total : 0;
    }

    // Enhanced methods for better resource management
    getAllocations() {
        return new Map(this.allocations);
    }

    getHistory(limit = 0) {
        if (limit <= 0) {
            return [...this.history];
        }
        return this.history.slice(-limit);
    }

    checkCost(cost) {
        return this.budget >= cost;
    }

    checkDerivationDepth(depth, maxDepth) {
        return depth <= maxDepth;
    }

    calculateComplexityPenalty(complexity) {
        if (this.config.enableComplexityPenalty === false) {
            return 1.0;
        }

        // Logarithmic penalty: higher complexity costs more, but diminishing returns
        // Base cost + log2(complexity)
        return 1 + Math.log2(Math.max(1, complexity));
    }

    reset() {
        this.budget = this.getAvailable() + this.getTotalAllocated();
        this.allocations.clear();
        this.history.length = 0; // More efficient than reassigning
    }

    // Utility method to check if an allocation exists
    hasAllocation(id) {
        return this.allocations.has(id);
    }

    // Get detailed statistics
    getStats() {
        return {
            available: this.budget,
            allocated: this.getTotalAllocated(),
            utilization: this.utilization(),
            allocationCount: this.allocations.size,
            historyCount: this.history.length
        };
    }
}