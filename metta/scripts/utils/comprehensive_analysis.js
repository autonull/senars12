/**
 * Comprehensive analysis of the syllogistic reasoning issue
 * This test examines every aspect of the (a-->b) + (b-->c) -> (a-->c) example
 */
import {NAR} from './src/nar/NAR.js';
import {SyllogisticRule} from './src/reasoning/rules/syllogism.js';

console.log('🔍 COMPREHENSIVE SYLLOGISTIC REASONING ANALYSIS');
console.log('================================================');

async function analyzeSyllogisticReasoning() {
    // 1. Check if rules are properly registered
    console.log('\\n1. Checking rule registration...');
    const nar = new NAR();
    await nar.initialize();

    // Check if syllogistic rule exists
    const ruleEngine = nar.ruleEngine;
    console.log(`Rule engine has strategy: ${!!ruleEngine?._reasoningStrategy}`);
    if (ruleEngine._reasoningStrategy?.rules) {
        console.log(`Number of rules: ${ruleEngine._reasoningStrategy.rules.length}`);
        ruleEngine._reasoningStrategy.rules.forEach((rule, i) => {
            console.log(`  Rule ${i}: ${rule.constructor.name} - ${rule.id || 'no id'}`);
        });
    }

    // 2. Test direct rule application
    console.log('\\n2. Testing direct syllogistic rule creation...');
    try {
        const syllogisticRule = SyllogisticRule.create(nar._termFactory);
        console.log(`✅ Syllogistic rule created successfully: ${syllogisticRule.id}`);
        console.log(`   Premises: ${syllogisticRule.premises.length}`);
        console.log(`   Conclusion: ${!!syllogisticRule.conclusion}`);
    } catch (error) {
        console.log(`❌ Error creating syllogistic rule: ${error.message}`);
    }

    // 3. Test input and basic processing
    console.log('\\n3. Testing input processing...');

    console.log('\\n3a. Inputting (a-->b).');
    const result1 = await nar.input('(a-->b).');
    console.log(`   Input result: ${result1}`);

    console.log('   Memory after input (a-->b):');
    const stats1 = nar.getStats();
    console.log(`     Concepts: ${stats1.memoryStats?.memoryUsage?.concepts || stats1.memoryStats?.totalConcepts || 0}`);
    console.log(`     Total tasks: ${stats1.memoryStats?.memoryUsage?.totalTasks || stats1.memoryStats?.totalTasks || 0}`);

    const beliefs1 = nar.getBeliefs();
    console.log(`     Beliefs: ${beliefs1.length}`);
    beliefs1.forEach((task, i) => {
        const term = task.term?.toString?.() || task.term || 'Unknown';
        const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
        const priority = task.budget?.priority?.toFixed(3) || 'N/A';
        console.log(`       ${i + 1}. ${term} [${truth}] pri:${priority}`);
    });

    console.log('\\n3b. Inputting (b-->c).');
    const result2 = await nar.input('(b-->c).');
    console.log(`   Input result: ${result2}`);

    console.log('   Memory after input (b-->c):');
    const stats2 = nar.getStats();
    console.log(`     Concepts: ${stats2.memoryStats?.memoryUsage?.concepts || stats2.memoryStats?.totalConcepts || 0}`);
    console.log(`     Total tasks: ${stats2.memoryStats?.memoryUsage?.totalTasks || stats2.memoryStats?.totalTasks || 0}`);

    const beliefs2 = nar.getBeliefs();
    console.log(`     Beliefs: ${beliefs2.length}`);
    beliefs2.forEach((task, i) => {
        const term = task.term?.toString?.() || task.term || 'Unknown';
        const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
        const priority = task.budget?.priority?.toFixed(3) || 'N/A';
        console.log(`       ${i + 1}. ${term} [${truth}] pri:${priority}`);
    });

    // 4. Check concept structure
    console.log('\\n4. Checking concept structure...');
    const concepts = nar.memory.getAllConcepts();
    console.log(`Total concepts: ${concepts.length}`);
    concepts.forEach((concept, i) => {
        console.log(`  Concept ${i + 1}: ${concept.term.toString()}`);
        console.log(`    Total tasks: ${concept.totalTasks}`);
        console.log(`    Beliefs: ${concept.getTasksByType('BELIEF').length}`);
        console.log(`    Activation: ${concept.activation.toFixed(3)}`);
        console.log(`    Quality: ${concept.quality?.toFixed(3) || 'N/A'}`);

        const beliefs = concept.getTasksByType('BELIEF');
        beliefs.forEach((task, j) => {
            const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
            const priority = task.budget?.priority?.toFixed(3) || 'N/A';
            console.log(`      Belief ${j + 1}: ${task.term.toString()} [${truth}] pri:${priority}`);
        });
    });

    // 5. Step-by-step cycle analysis
    console.log('\\n5. Step-by-step cycle analysis...');
    for (let cycle = 1; cycle <= 5; cycle++) {
        console.log(`\\n  Cycle ${cycle}:`);

        // Get state before step
        const beforeBeliefs = nar.getBeliefs();
        const beforeStats = nar.getStats();
        console.log(`    Before step - Beliefs: ${beforeBeliefs.length}, Tasks: ${beforeStats.memoryStats?.memoryUsage?.totalTasks || beforeStats.memoryStats?.totalTasks || 0}`);

        // Execute one step
        const stepResult = await nar.step();

        // Get state after step
        const afterBeliefs = nar.getBeliefs();
        const afterStats = nar.getStats();
        console.log(`    After step  - Beliefs: ${afterBeliefs.length}, Tasks: ${afterStats.memoryStats?.memoryUsage?.totalTasks || afterStats.memoryStats?.totalTasks || 0}`);

        // Check for derived (a-->c)
        const hasAC = afterBeliefs.some(belief => {
            const term = belief.term?.toString?.() || belief.term || '';
            return term.includes('a-->c');
        });

        if (hasAC) {
            console.log(`    🎉 FOUND (a-->c) derivation in cycle ${cycle}!`);
            const acBelief = afterBeliefs.find(belief =>
                (belief.term?.toString?.() || belief.term || '').includes('a-->c')
            );
            if (acBelief) {
                console.log(`       Derived: ${(acBelief.term?.toString?.() || acBelief.term)} with ${acBelief.truth.frequency},${acBelief.truth.confidence}`);
            }
            break;
        }

        if (afterBeliefs.length === 0) {
            console.log(`    ❌ All beliefs disappeared in cycle ${cycle}!`);
            break;
        }
    }

    // 6. Check if (a-->c) exists anywhere in memory
    console.log('\\n6. Checking entire memory for (a-->c)...');
    let foundAC = false;
    const allConcepts = nar.memory.getAllConcepts();
    for (const concept of allConcepts) {
        const termStr = concept.term.toString();
        if (termStr.includes('a-->c')) {
            console.log(`   Found concept (a-->c): ${termStr}`);
            foundAC = true;

            const allTasks = concept.getAllTasks();
            allTasks.forEach((task, i) => {
                const taskTerm = task.term?.toString?.() || task.term || 'Unknown';
                const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
                const priority = task.budget?.priority?.toFixed(3) || 'N/A';
                console.log(`     Task ${i + 1}: ${taskTerm} [${truth}] pri:${priority}`);
            });
        }
    }

    if (!foundAC) {
        console.log('   (a-->c) not found in any concept');
    }

    // 7. Check memory configuration
    console.log('\\n7. Memory configuration:');
    console.log(`   Max concepts: ${nar.config?.memory?.maxConcepts}`);
    console.log(`   Max tasks per concept: ${nar.config?.memory?.maxTasksPerConcept}`);
    console.log(`   Priority threshold: ${nar.config?.memory?.priorityThreshold}`);
    console.log(`   Priority decay rate: ${nar.config?.memory?.priorityDecayRate}`);
    console.log(`   Forgetting policy: ${nar.config?.memory?.forgetPolicy}`);

    return {
        initialBeliefs: beliefs2.length,
        finalBeliefs: nar.getBeliefs().length,
        hasAC: foundAC
    };
}

analyzeSyllogisticReasoning()
    .then(results => {
        console.log('\\n=== ANALYSIS RESULTS ===');
        console.log(`Initial beliefs: ${results.initialBeliefs}`);
        console.log(`Final beliefs: ${results.finalBeliefs}`);
        console.log(`(a-->c) derived: ${results.hasAC ? 'YES' : 'NO'}`);

        if (results.finalBeliefs === 0) {
            console.log('\\n🔴 CRITICAL ISSUE: All beliefs disappeared during reasoning!');
        } else if (!results.hasAC) {
            console.log('\\n🔴 ISSUE: Syllogistic reasoning did not produce (a-->c)');
        } else {
            console.log('\\n✅ Success: Syllogistic reasoning worked!');
        }
    })
    .catch(error => {
        console.error('\\n❌ Test failed with error:', error);
    });