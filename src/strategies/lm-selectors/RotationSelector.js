import { ConfigurableStrategy } from '../base';
export class RotationSelector extends ConfigurableStrategy {
    constructor(offset = 0) {
        super('rotation', 'Round-robin across cycles', { offset });
    }
    get offset() {
        return this.config.offset;
    }
    select(rules, ctx) {
        const start = (ctx.rotationIndex ?? 0) + this.offset;
        const result = [];
        for (let i = 0; i < ctx.maxRules && result.length < rules.length; i++) {
            const rule = rules[(start + i) % rules.length];
            if (rule)
                result.push(rule);
        }
        return result;
    }
}
