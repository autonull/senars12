/**
 * Deep analysis of rule application for the syllogistic case
 */
import {NAR} from './src/nar/NAR.js';
import {SyllogisticRule} from './src/reasoning/rules/syllogism.js';

async function analyzeRuleApplication() {
    console.log('🔍 DEEP RULE APPLICATION ANALYSIS');
    console.log('==================================');

    const nar = new NAR();
    await nar.initialize();

    // Add the syllogistic rule manually to be sure it's there
    const syllogisticRule = SyllogisticRule.create(nar._termFactory);
    console.log(`\\nCreated syllogistic rule: ${syllogisticRule.id}`);
    console.log(`Premises: [${syllogisticRule.premises.map(p => p.toString()).join(', ')}]`);
    console.log(`Conclusion: ${syllogisticRule.conclusion.toString()}`);

    // Add it to the rule engine to be sure
    nar.ruleEngine.register(syllogisticRule);

    // Input our test terms
    console.log('\\nInputting (a-->b). and (b-->c).');
    await nar.input('(a-->b). %1.0;0.9%');
    await nar.input('(b-->c). %1.0;0.9%');

    // Get the tasks directly to test the rule
    const beliefs = nar.getBeliefs();
    console.log(`\\nRetrieved ${beliefs.length} beliefs:`);
    beliefs.forEach((task, i) => {
        const term = task.term?.toString?.() || task.term || 'Unknown';
        const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
        console.log(`  ${i + 1}. ${term} [${truth}]`);
    });

    if (beliefs.length >= 2) {
        const task1 = beliefs[0];
        const task2 = beliefs[1];

        console.log(`\\nTesting rule application to: [${task1.term.toString()}, ${task2.term.toString()}]`);

        // Try applying the rule directly
        try {
            const results = await syllogisticRule._apply([task1, task2], null, nar._termFactory);
            console.log(`Direct rule application results: ${results.length} items`);

            results.forEach((result, i) => {
                const term = result.term?.toString?.() || result.term || 'Unknown';
                const truth = result.truth ? `${result.truth.frequency},${result.truth.confidence}` : 'NULL';
                console.log(`  ${i + 1}. ${term} [${truth}]`);
            });
        } catch (error) {
            console.log(`Direct rule application failed: ${error.message}`);
            console.error(error.stack);
        }

        // Also try reverse order
        try {
            const results = await syllogisticRule._apply([task2, task1], null, nar._termFactory);
            console.log(`Reverse rule application results: ${results.length} items`);

            results.forEach((result, i) => {
                const term = result.term?.toString?.() || result.term || 'Unknown';
                const truth = result.truth ? `${result.truth.frequency},${result.truth.confidence}` : 'NULL';
                console.log(`  ${i + 1}. ${term} [${truth}]`);
            });
        } catch (error) {
            console.log(`Reverse rule application failed: ${error.message}`);
        }
    }

    // Now run one cycle and check results
    console.log('\\nRunning reasoning cycle...');
    const cycleResult = await nar.step();

    const finalBeliefs = nar.getBeliefs();
    console.log(`\\nBeliefs after cycle: ${finalBeliefs.length}`);
    finalBeliefs.forEach((task, i) => {
        const term = task.term?.toString?.() || task.term || 'Unknown';
        const truth = task.truth ? `${task.truth.frequency},${task.truth.confidence}` : 'NULL';
        const type = task.type;
        console.log(`  ${i + 1}. ${term} [${type}] [${truth}]`);
    });

    // Check specifically for (a-->c)
    const hasAC = finalBeliefs.some(belief => {
        const term = belief.term?.toString?.() || belief.term || '';
        return term === 'a-->c' || term.includes('(a-->c)') || term.includes('a-->c');
    });

    console.log(`\\n(a-->c) found: ${hasAC ? 'YES' : 'NO'}`);
}

analyzeRuleApplication();