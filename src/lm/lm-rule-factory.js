import { createCustomRule, createRule } from './rule-builders';
import { getRuleDef, ruleDefs } from './rule-templates/index';
import { SenarsError } from '../errors/senars-error';
export { LMRules } from './rule-selectors/factory';
export class LMRuleFactory {
    config;
    lm;
    constructor(lm, config = {}) {
        this.lm = lm;
        this.config = config;
    }
    static from(lm) {
        return new LMRuleFactory(lm);
    }
    id(id) {
        this.config.id = id;
        return this;
    }
    name(name) {
        this.config.name = name;
        return this;
    }
    description(desc) {
        this.config.description = desc;
        return this;
    }
    priority(p) {
        this.config.priority = p;
        return this;
    }
    prompt(template) {
        this.config.promptTemplate = template;
        return this;
    }
    taskType(type) {
        this.config.taskType = type;
        return this;
    }
    budget(b) {
        this.config.budget = b;
        return this;
    }
    multiline(ml) {
        this.config.multiline = ml;
        return this;
    }
    activation(fn) {
        this.config.activationCondition = fn;
        return this;
    }
    singlePremise(sp) {
        this.config.singlePremise = sp;
        return this;
    }
    createAll() {
        return ruleDefs.map((d) => createRule(this.lm, d));
    }
    build() {
        const id = this.config.id;
        if (!id)
            throw new SenarsError('LMRuleFactory: id is required when building custom rules', 'OPERATION_ERROR');
        const def = ruleDefs.find((d) => d.id === id);
        if (def)
            return createRule(this.lm, def, this.config);
        return createCustomRule(id, this.lm, this.config);
    }
    /**
     * Build one of the shipped rules by id, with this factory's overrides applied.
     * There were nineteen named wrappers over this call and eighteen of them had
     * no caller in the tree; the id is the rule's own name, and a wrapper per rule
     * is a list to keep in step with {@link ruleDefs}.
     */
    preset(id) {
        return createRule(this.lm, getRuleDef(id), this.config);
    }
}
/**
 * Builds LM rules from validated config entries (senars.config.json `bot.lmRules.rules`).
 * Entries whose id matches a built-in template are built as presets; others are custom rules.
 * Returns unknown ids so callers can log them.
 */
export function createConfiguredLMRules(lm, specs) {
    const factory = LMRuleFactory.from(lm);
    const rules = [];
    const unknownIds = [];
    for (const spec of specs) {
        const { enabled, prompt, ...config } = spec;
        const factoryConfig = {
            ...config,
            taskType: config.taskType,
            ...(prompt ? { promptTemplate: prompt } : {}),
        };
        factory.id(spec.id);
        const def = ruleDefs.find((d) => d.id === spec.id);
        const rule = def
            ? createRule(lm, def, factoryConfig)
            : createCustomRule(spec.id, lm, factoryConfig);
        if (!def)
            unknownIds.push(spec.id);
        if (enabled === false)
            rule.disable();
        rules.push(rule);
    }
    return { rules, unknownIds };
}
