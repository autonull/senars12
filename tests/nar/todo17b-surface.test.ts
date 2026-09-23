import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bench 40 — Surface Truth (TODO17b Phase C)
 * Grep-guard: no `undefined` rule exports; no zero-reader bot config fields;
 * the bot's CommandRegistry is populated at bind; README rule claims have
 * implementations.
 */

const ROOT = join(import.meta.dirname, '../..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
};

describe('Bench 40 — Surface Truth', () => {
  it('D18 — no `undefined` rule exports remain in the rule tree', () => {
    const offenders = walk(join(ROOT, 'nar/src/rules')).filter((f) =>
      readFileSync(f, 'utf-8').includes('= undefined as unknown as RuleFn')
    );
    expect(offenders).toEqual([]);
  });

  it('D21 — every bot config field has at least one reader in src/', () => {
    const schemaSrc = readFileSync(join(ROOT, 'src/config/schema.ts'), 'utf-8');
    const botSection =
      /export const botConfigSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(schemaSrc)?.[1] ?? '';
    const fields = [...botSection.matchAll(/^ {2}(\w+): z/gm)].map((m) => m[1] as string);
    expect(fields.length).toBeGreaterThan(0);

    const allSrc = [
      ...walk(join(ROOT, 'src')),
      ...walk(join(ROOT, 'nar/src')),
      ...walk(join(ROOT, 'core/src')),
    ]
      .map((f) => readFileSync(f, 'utf-8'))
      .join('\n');
    for (const field of fields) {
      const reader = allSrc.includes(`bot.${field}`) || allSrc.includes(`bot?.${field}`);
      expect(reader, `bot.${field} has no reader`).toBe(true);
    }
  });

  it('D19 — the bot populates its CommandRegistry at bind time', () => {
    const botSrc = readFileSync(join(ROOT, 'src/bin/bot.ts'), 'utf-8');
    expect(botSrc.includes('new CommandRegistry()')).toBe(true);
    expect(botSrc.includes('.register(')).toBe(true);
    expect(botSrc.includes('coreCommands')).toBe(true);
    expect(botSrc.includes('createAuthCommands')).toBe(true);
  });

  it('D24 — README rule-matrix claims have implementations', async () => {
    const { NALRules, NALExtendedRules } = await import('../../nar/src/rules');
    const rules = { ...NALRules, ...NALExtendedRules } as Record<string, unknown>;
    for (const claimed of [
      'modusPonens',
      'modusTollens',
      'disjunctiveSyllogism',
      'intersectionComposition',
      'unionComposition',
      'difference',
      'decompose',
      'conversion',
      'temporalDeduction',
      'predictiveImplication',
      'proceduralChaining',
      'variableDependency',
      'variableIntroduction',
    ]) {
      expect(typeof rules[claimed]).toBe('function');
    }
  });
});