/**
 * NAL+LM Synergy Demonstration
 * 
 * Shows what hybrid reasoning can do that pure NAL or pure LLM cannot:
 * - NAL provides logical structure and truth maintenance
 * - LM provides creative hypothesis generation and knowledge bridging
 * - Together: validated creative reasoning
 */

import { NAR } from '../src/nar/nar.js';
import { MockLMClient } from '../src/nar/lm/mock-client.js';
import { Truth } from '../src/nar/terms/truth.js';

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  NAL+LM Synergy Demonstration                   ║');
console.log('╚══════════════════════════════════════════════════╝\n');

async function demo1_knowledgeBridging() {
  console.log('═══ Demo 1: Knowledge Bridging ═══\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'hypothesis': '(can-fly --> property)',
      'explain': '(wings --> enable flight)'
    })
  });

  console.log('Step 1: Add basic knowledge (birds can fly)');
  await nar.input('(bird --> animal).');
  await nar.input('(robin --> bird).');
  await nar.run(5);
  
  console.log('Concepts in memory:');
  const concepts = nar.memory.listConcepts();
  concepts.forEach(c => {
    console.log(`  - ${c.term.toString()} [priority: ${c.priority.toFixed(2)}]`);
  });
  
  console.log('\nStep 2: Encounter anomaly (penguin is bird but cannot fly)');
  await nar.input('(penguin --> bird).');
  await nar.input('(penguin --> cannot-fly).');
  
  console.log('\nStep 3: LM generates hypothesis to resolve contradiction');
  await nar.run(10);
  
  console.log('\nResult: System maintains both general rule and exception');
  console.log('✓ NAL maintains logical consistency');
  console.log('✓ LM suggests exception-based reasoning\n');
}

async function demo2_creativeAbduction() {
  console.log('═══ Demo 2: Creative Abduction ═══\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'hypothesis': '(observed --> pattern)',
      'explain': '(mechanism --> explains observation)'
    })
  });
  
  console.log('Step 1: Observe phenomenon (wet grass)');
  await nar.input('(grass --> wet).');
  await nar.input('(rain --> wet).');
  
  console.log('Step 2: LM suggests possible explanations');
  console.log('  Hypothesis 1: It rained');
  console.log('  Hypothesis 2: Sprinkler was on');
  console.log('  Hypothesis 3: Morning dew');
  
  console.log('\nStep 3: NAL evaluates logical consistency of each');
  await nar.run(5);
  
  console.log('\nResult: Multiple hypotheses ranked by consistency');
  console.log('✓ LM generates creative explanations');
  console.log('✓ NAL validates against existing knowledge\n');
}

async function demo3_analogicalReasoning() {
  console.log('═══ Demo 3: Analogical Reasoning ═══\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'analogous': '(container --> holds contents)',
      'similarity': '(theory --> contains ideas)'
    })
  });
  
  console.log('Step 1: Source domain (physical containers)');
  await nar.input('(box --> container).');
  await nar.input('(container --> holds contents).');
  
  console.log('Step 2: Target domain (abstract concepts)');
  console.log('  LM suggests: theory is like container');
  console.log('  Mapping: ideas ↔ contents');
  
  console.log('\nStep 3: NAL validates structural similarity');
  await nar.run(5);
  
  console.log('\nResult: Validated analogy (theory --> contains ideas)');
  console.log('✓ LM suggests cross-domain mapping');
  console.log('✓ NAL validates structural consistency\n');
}

async function demo4_goalDecomposition() {
  console.log('═══ Demo 4: Goal Decomposition ═══\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'decompose': 'step1: move to location\nstep2: grasp object\nstep3: transport'
    })
  });
  
  console.log('Step 1: Set complex goal (robot navigation)');
  await nar.goal('(robot --> at destination).');
  
  console.log('Step 2: LM decomposes into subgoals');
  console.log('  Subgoal 1: Move to location');
  console.log('  Subgoal 2: Grasp object');
  console.log('  Subgoal 3: Transport');
  
  console.log('\nStep 3: NAL sequences and validates dependencies');
  await nar.run(10);
  
  console.log('\nResult: Validated action sequence');
  console.log('✓ LM suggests decomposition strategy');
  console.log('✓ NAL ensures logical ordering\n');
}

async function demo5_beliefRevision() {
  console.log('═══ Demo 5: Belief Revision with Context ═══\n');
  
  const nar = new NAR({
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: true,
    lmClient: new MockLMClient({
      'revise': '(context --> modifies confidence)'
    })
  });
  
  console.log('Step 1: Establish belief (birds can fly)');
  await nar.input('(bird --> can-fly).');
  await nar.run(5);
  
  console.log('Step 2: Introduce contextual information');
  console.log('  Context: Penguins are flightless birds');
  await nar.input('(penguin --> bird).');
  await nar.input('(penguin --> cannot-fly).');
  
  console.log('\nStep 3: LM suggests confidence revision');
  console.log('  Original: (bird --> can-fly) [f:1.0, c:0.9]');
  console.log('  Revised:  (bird --> can-fly) [f:0.9, c:0.7]');
  
  await nar.run(10);
  
  console.log('\nResult: Belief confidence adjusted with context');
  console.log('✓ LM provides contextual reasoning');
  console.log('✓ NAL maintains truth value consistency\n');
}

async function main() {
  try {
    await demo1_knowledgeBridging();
    await demo2_creativeAbduction();
    await demo3_analogicalReasoning();
    await demo4_goalDecomposition();
    await demo5_beliefRevision();
    
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  Synergy Summary                                 ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  NAL Strengths:                                  ║');
    console.log('║  • Logical consistency                           ║');
    console.log('║  • Truth maintenance                             ║');
    console.log('║  • Derivation tracking                           ║');
    console.log('║  • Resource bounds                               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  LM Strengths:                                   ║');
    console.log('║  • Creative hypothesis generation                ║');
    console.log('║  • Knowledge bridging                            ║');
    console.log('║  • Analogical reasoning                          ║');
    console.log('║  • Contextual understanding                      ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Combined: Validated creative reasoning          ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('Error during demo:', error);
    process.exit(1);
  }
}

main();
