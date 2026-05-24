#!/usr/bin/env node
/**
 * lm-synergy-demo.mjs
 *
 * Pipes Narsese through the SeNARS REPL, demonstrating
 * NARS + LM cognitive synergy that NARS alone cannot achieve.
 *
 * What NARS alone CAN do:
 *   (bird --> animal) + (robin --> bird) → (robin --> animal)
 *
 * What NARS alone CANNOT do (but LM rules enable):
 *   • Translate NL → Narsese (lm-narsese-translation)
 *   • Elaborate concept properties from world knowledge (lm-concept-elaboration)
 *   • Generate hypotheses from observations (lm-hypothesis-generation)
 *   • Analogical reasoning between concepts (lm-analogical-reasoning)
 *   • Decompose complex goals (lm-goal-decomposition)
 *
 * Pipe format: one statement per line.
 *
 * Usage: node tests/lm-synergy-demo.mjs | pnpm exec tsx src/cli/repl.ts
 */

const lines = [
  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: NARS symbolic inheritance chain
  // ═══════════════════════════════════════════════════════════════
  '(bird --> animal). :0.9:0.95',
  '(robin --> bird). :0.85:0.90',
  // NARS will derive: (robin --> animal) — pure deduction

  // ═══════════════════════════════════════════════════════════════
  // STAGE 2: Goal that only LM can decompose
  // ═══════════════════════════════════════════════════════════════
  // Complex goal triggers lm-goal-decomposition (LM rule):
  // NARS alone cannot decompose "(find_food & build_nest)!" into subgoals
  '(find_food & build_nest)! :0.5:0.8',

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: Low-confidence belief triggers lm-hypothesis-generation
  // ═══════════════════════════════════════════════════════════════
  // A belief with confidence < 0.5 triggers hypothesis generation
  '(strange --> noise). :0.6:0.3',

  // ═══════════════════════════════════════════════════════════════
  // STAGE 4: Concepts for LM to elaborate
  // ═══════════════════════════════════════════════════════════════
  // Underconnected concept triggers lm-concept-elaboration
  '(quantum --> physics). :0.8:0.9',

  // ═══════════════════════════════════════════════════════════════
  // STAGE 5: Check stats and LM rule calls
  // ═══════════════════════════════════════════════════════════════
  '.stats',
  '.goals',
  '.priorities',
  '.lm',
  '.quit',
];

// Output each line with a small delay to simulate pipe, but first
// emit a header as comments
console.log('# LM Cognitive Synergy Demo');
console.log('# Pipeline: NARS inference → LM Rule Enrichment → Feedback');
console.log('#');
console.log('# NARS-only:   (bird --> animal) + (robin --> bird) → (robin --> animal)');
console.log('# LM synergy:   Concept elaboration, hypothesis generation, NL translation');
console.log('# Priority:     LM rules fire when premise maxPriority >= 0.5');

for (const line of lines) {
  console.log(line);
}
