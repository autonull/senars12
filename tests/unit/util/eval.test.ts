import { describe, expect, it } from 'vitest';
import { evaluateExpression, ExpressionError } from '@senars/util/utils/eval';

describe('evaluateExpression', () => {
  it('evaluates arithmetic with correct precedence', () => {
    expect(evaluateExpression('2 + 2 * 3')).toBe(8);
    expect(evaluateExpression('(2 + 2) * 3')).toBe(12);
    expect(evaluateExpression('10 / 4')).toBe(2.5);
    expect(evaluateExpression('7 % 3')).toBe(1);
    expect(evaluateExpression('-3 + 5')).toBe(2);
    expect(evaluateExpression('2 * -3')).toBe(-6);
    expect(evaluateExpression('3.5 * 2')).toBe(7);
  });

  it('rejects non-arithmetic input', () => {
    for (const expr of ['process.exit(1)', 'constructor', '1 + a', 'import("fs")', 'this', '', '1; 2', '(1']) {
      expect(() => evaluateExpression(expr)).toThrow(ExpressionError);
    }
  });

  it('rejects non-finite results', () => {
    expect(() => evaluateExpression('1 / 0')).toThrow(ExpressionError);
  });
});
