export type ForgettingPolicy =
    | { type: 'priority'; threshold: number }
    | { type: 'age'; maxAgeMs: number }
    | { type: 'composite'; weights: { priority: number; age: number } };

export class Forgetting {
    static priority(policy: ForgettingPolicy, priority: number): boolean {
        if (policy.type === 'priority') {
            return priority < policy.threshold;
        }
        return false;
    }

    static age(policy: ForgettingPolicy, lastAccess: number): boolean {
        if (policy.type === 'age') {
            return Date.now() - lastAccess > policy.maxAgeMs;
        }
        return false;
    }

    static composite(
        policy: ForgettingPolicy,
        priority: number,
        lastAccess: number
    ): boolean {
        if (policy.type !== 'composite') return false;

        const pScore = priority * policy.weights.priority;
        const aScore = (Date.now() - lastAccess) / 1000 * policy.weights.age;
        return (pScore + aScore) > 1;
    }

    static shouldForget(
        policy: ForgettingPolicy,
        priority: number,
        lastAccess: number
    ): boolean {
        switch (policy.type) {
            case 'priority':
                return Forgetting.priority(policy, priority);
            case 'age':
                return Forgetting.age(policy, lastAccess);
            case 'composite':
                return Forgetting.composite(policy, priority, lastAccess);
            default:
                return false;
        }
    }
}