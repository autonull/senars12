/**
 * Dynamic LM rule generation and composite rules.
 */
import type { Term } from '../terms';
import type { Task } from '../types';
import { LMResponseParser, LMRule } from './LMRule.js';
import type { LMRuleConfig, LMService } from './lm-service.js';

export interface ValidationRule {
  type: 'narsese' | 'json' | 'custom';
  pattern?: string;
  validator?: (response: string) => boolean;
  message: string;
}

export interface DynamicRuleConfig extends Partial<LMRuleConfig> {
  name: string;
  description: string;
  naturalLanguageDescription: string;
  promptTemplate?: string;
  validationRules?: ValidationRule[];
}

export class DynamicLMRuleGenerator {
  private readonly lm: LMService;
  private readonly baseConfig: Partial<LMRuleConfig>;

  constructor(lm: LMService, baseConfig?: Partial<LMRuleConfig>) {
    this.lm = lm;
    this.baseConfig = baseConfig ?? {};
  }

  async generateRuleFromDescription(description: string): Promise<LMRule | null> {
    const prompt = `
You are a NARS reasoning system configuration generator.
Given a natural language description of a reasoning rule, generate a rule configuration.

Description: ${description}

Generate a rule in this format:
{
  "id": "rule-id",
  "name": "Rule Name",
  "description": "Description",
  "priority": 0.8,
  "promptTemplate": "Template with {{primaryTerm}} placeholder"
}

Respond with JSON only:
`.trim();

    try {
      const response = await this.lm.generateText(prompt);
      const config = this.parseRuleConfig(response, description);
      return config ? new LMRule(config.id!, this.lm, config) : null;
    } catch {
      return null;
    }
  }

  createRuleFromTemplate(
    id: string,
    name: string,
    description: string,
    promptTemplate: string,
    priority = 0.8
  ): LMRule {
    return new LMRule(id, this.lm, {
      ...this.baseConfig,
      id,
      name,
      description,
      priority,
      promptTemplate,
      singlePremise: true,
    });
  }

  validateResponse(
    response: string,
    rules: ValidationRule[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'narsese':
          if (!this.validateNarsese(response, rule.message, errors)) {
            errors.push(rule.message);
          }
          break;
        case 'json':
          if (!this.validateJSON(response, rule.message, errors)) {
            errors.push(rule.message);
          }
          break;
        case 'custom':
          if (rule.validator && !rule.validator(response)) {
            errors.push(rule.message);
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateNarsese(response: string, message: string, errors: string[]): boolean {
    try {
      const parsed = LMResponseParser.parse(response);
      if (!parsed.valid) {
        errors.push(message || 'Invalid Narsese format');
        return false;
      }
      return true;
    } catch {
      errors.push(message || 'Failed to parse Narsese');
      return false;
    }
  }

  private validateJSON(response: string, message: string, errors: string[]): boolean {
    try {
      JSON.parse(response);
      return true;
    } catch {
      errors.push(message || 'Invalid JSON format');
      return false;
    }
  }

  private parseRuleConfig(response: string, description: string): LMRuleConfig | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const obj = JSON.parse(jsonMatch[0]);
      return {
        id: obj.id || `dynamic-rule-${Date.now()}`,
        name: obj.name || 'Dynamic Rule',
        description: obj.description || description,
        priority: obj.priority ?? 0.8,
        promptTemplate: obj.promptTemplate || `Reason about: {{primaryTerm}}`,
        singlePremise: true,
      };
    } catch {
      return {
        id: `dynamic-rule-${Date.now()}`,
        name: 'Dynamic Rule',
        description,
        priority: 0.8,
        promptTemplate: `Reason about: {{primaryTerm}}`,
        singlePremise: true,
      };
    }
  }
}

export class CompositeLMRule extends LMRule {
  private readonly componentRules: LMRule[] = [];

  constructor(id: string, lm: LMService, config: LMRuleConfig) {
    super(id, lm, config);
  }

  addRule(rule: LMRule): void {
    this.componentRules.push(rule);
  }

  override async apply(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ): Promise<Task[]> {
    const allTasks: Task[] = [];

    for (const rule of this.componentRules) {
      try {
        const tasks = await rule.apply(primary, secondary, context);
        allTasks.push(...tasks);
      } catch {
        // expected: individual rule failure shouldn't abort other rules
      }
    }

    return allTasks;
  }

  override canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean {
    return this.componentRules.some((rule) => rule.canApply(primary, secondary, context));
  }
}

export const createDynamicRuleGenerator = (
  lm: LMService,
  baseConfig?: Partial<LMRuleConfig>
): DynamicLMRuleGenerator => {
  return new DynamicLMRuleGenerator(lm, baseConfig);
};

export const createCompositeRule = (
  id: string,
  lm: LMService,
  config: LMRuleConfig
): CompositeLMRule => {
  return new CompositeLMRule(id, lm, config);
};
