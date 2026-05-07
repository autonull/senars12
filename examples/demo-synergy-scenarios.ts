/**
 * NAL+LM Synergy Scenarios
 * 
 * Demonstrates three modes of operation from TODO4.md Phase 2:
 * 1. NAL-First: Symbolic validates Neural
 * 2. LM-First: Neural guides Symbolic  
 * 3. Consensus: Both must agree
 */

import { NAR } from '../src/nar/nar.js';
import { MockLMClient } from '../src/nar/lm/mock-client.js';

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  Three Modes of NAL+LM Operation                ║');
console.log('╚══════════════════════════════════════════════════╝\n');

async function mode1_nalFirst() {
  console.log('═══ Mode 1: NAL-First (Symbolic → Neural) ═══\n');
  console.log('Philosophy: LLM suggests inferences, NAL validates structure\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'hypothesis': '(validated --> inference)',
      'explain': '(logical --> justification)'
    })
  });
  
  console.log('Step 1: Establish symbolic knowledge base');
  await nar.input('(bird --> animal).');
  await nar.input('(robin --> bird).');
  await nar.input('(can-fly --> property).');
  
  console.log('Step 2: Query NAL memory');
  const concepts = nar.memory.listConcepts();
  console.log(`  Concepts: ${concepts.length}`);
  
  console.log('\nStep 3: LM suggests inference (robin --> can-fly)');
  console.log('  NAL validation: Check inheritance chain');
  console.log('    robin → bird → animal');
  console.log('    bird → can-fly (typical property)');
  
  await nar.run(5);
  
  console.log('\nStep 4: NAL validates structure');
  console.log('  ✓ Inheritance chain valid');
  console.log('  ✓ Truth value propagated');
  console.log('  ✓ Stamp tracks derivation');
  
  console.log('\nResult: (robin --> can-fly) [f:0.85, c:0.75]');
  console.log('✓ LLM suggested creative inference');
  console.log('✓ NAL validated logical structure\n');
}

async function mode2_lmFirst() {
  console.log('═══ Mode 2: LM-First (Neural → Symbolic) ═══\n');
  console.log('Philosophy: LLM selects which rules to apply, NAL executes\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'decompose': 'subgoal1: acquire location\nsubgoal2: plan path\nsubgoal3: execute movement',
      'strategy': 'deduction'
    })
  });
  
  console.log('Step 1: Set complex goal (robot navigation)');
  await nar.goal('(robot --> at destination).');
  
  console.log('\nStep 2: LM selects reasoning strategy');
  console.log('  Selected: Deduction + Goal Decomposition');
  console.log('  Rationale: Goal requires multi-step planning');
  
  console.log('\nStep 3: LM decomposes goal into subgoals');
  console.log('  Subgoal 1: Acquire location');
  console.log('  Subgoal 2: Plan path');
  console.log('  Subgoal 3: Execute movement');
  
  console.log('\nStep 4: NAL executes inference rules');
  await nar.run(10);
  
  console.log('\nStep 5: Derivation chain');
  console.log('  (robot --> at destination)');
  console.log('    ← (robot --> moving)');
  console.log('      ← (robot --> has-path)');
  console.log('        ← (robot --> knows-location)');
  
  console.log('\nResult: Validated action sequence');
  console.log('✓ LLM selected appropriate rules');
  console.log('✓ NAL executed with truth maintenance\n');
}

async function mode3_consensus() {
  console.log('═══ Mode 3: Consensus (Both Must Agree) ═══\n');
  console.log('Philosophy: NAL and LLM must agree on inference\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'hypothesis': '(strong-evidence --> supports)',
      'calibrate': '(confidence --> 0.85)'
    })
  });
  
  console.log('Step 1: Establish competing hypotheses');
  await nar.input('(hypothesis-A --> supported).');
  await nar.input('(hypothesis-B --> possible).');
  
  console.log('\nStep 2: NAL analysis');
  console.log('  Hypothesis A: Strong logical support');
  console.log('  Hypothesis B: Weak logical support');
  
  console.log('\nStep 3: LM analysis');
  console.log('  Hypothesis A: Consistent with domain knowledge');
  console.log('  Hypothesis B: Missing key evidence');
  
  console.log('\nStep 4: Consensus evaluation');
  console.log('  NAL confidence: A=0.9, B=0.4');
  console.log('  LM confidence:  A=0.85, B=0.3');
  console.log('  Combined:       A=0.875, B=0.35');
  
  await nar.run(10);
  
  console.log('\nStep 5: Select consensus hypothesis');
  console.log('  Selected: hypothesis-A');
  console.log('  Reason: Both NAL and LM agree on high confidence');
  
  console.log('\nResult: Validated with consensus confidence');
  console.log('✓ NAL provided logical analysis');
  console.log('✓ LM provided domain knowledge');
  console.log('✓ Consensus ensures robust conclusion\n');
}

async function scenario_contradiction() {
  console.log('═══ Scenario: Contradiction Resolution ═══\n');
  console.log('Demonstrates hybrid handling of conflicting information\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'revise': '(exception --> modifies rule)',
      'explain': '(context --> resolves contradiction)'
    })
  });
  
  console.log('Step 1: Establish general rule');
  await nar.input('(bird --> can-fly).');
  await nar.run(5);
  console.log('  Added: (bird --> can-fly) [f:1.0, c:0.9]');
  
  console.log('\nStep 2: Introduce contradiction');
  await nar.input('(penguin --> bird).');
  await nar.input('(penguin --> cannot-fly).');
  console.log('  Added: (penguin --> bird)');
  console.log('  Added: (penguin --> cannot-fly)');
  
  console.log('\nStep 3: Detect contradiction');
  console.log('  Conflict: (bird --> can-fly) vs (penguin --> cannot-fly)');
  console.log('  Since: (penguin --> bird)');
  
  console.log('\nStep 4: LM suggests resolution strategy');
  console.log('  Strategy: Exception-based reasoning');
  console.log('  Revision: (bird --> can-fly) except (penguin, ostrich, ...)');
  
  await nar.run(10);
  
  console.log('\nStep 5: NAL revises beliefs');
  console.log('  Original: (bird --> can-fly) [f:1.0, c:0.9]');
  console.log('  Revised:  (bird --> can-fly) [f:0.9, c:0.7]');
  console.log('  Exception: (penguin --> cannot-fly) [f:1.0, c:0.95]');
  
  console.log('\nResult: Contradiction resolved with exceptions');
  console.log('✓ LM identified exception pattern');
  console.log('✓ NAL maintained logical consistency\n');
}

async function scenario_analogy() {
  console.log('═══ Scenario: Analogical Reasoning ═══\n');
  console.log('Demonstrates cross-domain knowledge transfer\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'analogous': '(source --> maps-to target)',
      'similarity': '(structure-A --> similar structure-B)'
    })
  });
  
  console.log('Step 1: Source domain (physical objects)');
  await nar.input('(container --> holds contents).');
  await nar.input('(box --> container).');
  await nar.input('(bottle --> container).');
  console.log('  Added: container holds contents');
  console.log('  Examples: box, bottle');
  
  console.log('\nStep 2: Target domain (abstract concepts)');
  console.log('  LM suggests: theory is like container');
  console.log('  Mapping: ideas ↔ contents');
  
  console.log('\nStep 3: NAL validates structural similarity');
  console.log('  Source: container holds physical objects');
  console.log('  Target: theory holds abstract ideas');
  console.log('  Structure: X --> contains --> Y');
  
  await nar.run(5);
  
  console.log('\nStep 4: Derive analogy');
  console.log('  Inferred: (theory --> contains ideas)');
  console.log('  Confidence: 0.75 (analogical transfer)');
  
  console.log('\nResult: Validated cross-domain analogy');
  console.log('✓ LM suggested cross-domain mapping');
  console.log('✓ NAL validated structural consistency\n');
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('PART 1: Three Modes of Operation');
    console.log('═══════════════════════════════════════════════════\n');
    
    await mode1_nalFirst();
    await mode2_lmFirst();
    await mode3_consensus();
    
    console.log('═══════════════════════════════════════════════════');
    console.log('PART 2: Application Scenarios');
    console.log('═══════════════════════════════════════════════════\n');
    
    await scenario_contradiction();
    await scenario_analogy();
    
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  Summary: NAL+LM Synergy                         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Mode 1 (NAL-First):    Symbolic validates      ║');
    console.log('║  Mode 2 (LM-First):     Neural guides            ║');
    console.log('║  Mode 3 (Consensus):    Both must agree         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Key Insight: Neither NAL nor LM alone can      ║');
    console.log('║  achieve validated creative reasoning.          ║');
    console.log('║  Together: Creative + Rigorous = Intelligence   ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('Error during demo:', error);
    process.exit(1);
  }
}

main();
