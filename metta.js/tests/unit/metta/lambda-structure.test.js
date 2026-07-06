/**
 *  Quick test to understand lambda structure
 */

import {Parser} from '../../../metta/src/Parser.js';
import {MeTTaTestUtils} from '../../helpers/MeTTaTestUtils.js';

describe('Lambda Structure Analysis', () => {
    test('analyze lambda application structure', () => {
        const parser = new Parser();

        // Parse lambda application
        const app = parser.parse('((λ $x $x) 5)');
        console.log('\n=== Lambda Application ===');
        console.log('String:', app.toString());
        console.log('Type:', app.type);
        console.log('Operator:', app.operator);
        console.log('Operator type:', app.operator?.type);
        console.log('Operator string:', app.operator?.toString());
        console.log('Components:', app.components);

        // Parse the lambda rule pattern
        const rulePattern = parser.parse('((λ $x $body) $v)');
        console.log('\n=== Lambda Rule Pattern ===');
        console.log('String:', rulePattern.toString());
        console.log('Operator:', rulePattern.operator);
        console.log('Operator type:', rulePattern.operator?.type);
        console.log('Operator string:', rulePattern.operator?.toString());

        // Check functor extraction
        const getFunctorName = (functor) => {
            if (typeof functor === 'string') return functor;
            if (functor?.type === 'atom') return functor.name;
            if (functor?.type === 'compound') return getFunctorName(functor.operator);
            return null;
        };

        console.log('\n=== Functor Analysis ===');
        console.log('App functor name:', getFunctorName(app));
        console.log('Pattern functor name:', getFunctorName(rulePattern));
    });

    test('check rule indexing in space', () => {
        const interp = MeTTaTestUtils.createInterpreter({loadStdlib: true});
        const parser = new Parser();

        // Get lambda application
        const app = parser.parse('((λ $x $x) 5)');

        // Get rules for this functor
        const rules = interp.space.rulesFor(app);
        console.log('\n=== Rules for lambda application ===');
        console.log('Number of rules:', rules.length);
        rules.slice(0, 5).forEach((r, i) => {
            console.log(`Rule ${i}:`, r.pattern?.toString());
        });

        // Try all rules 
        const allRules = interp.space.getRules();
        console.log('\n=== All rules count:', allRules.length);

        // Find lambda rules
        const lambdaRules = allRules.filter(r =>
            r.pattern?.toString().includes('λ') ||
            r.pattern?.toString().includes('lambda')
        );
        console.log('\n=== Lambda rules ===');
        lambdaRules.forEach((r, i) => {
            console.log(`Lambda rule ${i}:`, r.pattern?.toString(), '-\u003e', r.result?.toString());
        });
    });
});
