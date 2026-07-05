/**
 * Lambda Rule Matching Debug Test
 * Add detailed logging to understand why lambda rules don't match
 */

import {MeTTaTestUtils} from '../../helpers/MeTTaTestUtils.js';
import {Parser} from '../../../metta/src/Parser.js';
import {Unify} from '../../../metta/src/index.js';

describe('Lambda Rule Matching Debug', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = MeTTaTestUtils.createInterpreter({loadStdlib: true});
    });

    test('trace lambda rule matching step by step', async () => {
        const parser = new Parser();

        // Parse lambda application
        const app = parser.parse('((λ $x $x) 5)');
        console.log('\n=== Lambda Application ===');
        console.log('Parsed:', app.toString());
        console.log('Operator:', app.operator?.toString());
        console.log('Operator type:', app.operator?.type);
        console.log('Components:', app.components?.map(c => c.toString()));

        // Check what functor name is extracted
        const getFunctorName = (functor) => {
            if (typeof functor === 'string') return functor;
            if (functor?.type === 'atom') return functor.name;
            if (functor?.type === 'compound') return getFunctorName(functor.operator);
            return null;
        };

        const functorName = getFunctorName(app);
        console.log('Functor name extracted:', functorName);

        // Get rules for this functor
        const rules = interpreter.space.rulesFor(app);
        console.log('\n=== Rules returned by rulesFor() ===');
        console.log('Number of rules:', rules.length);

        // Find lambda rules
        const lambdaRules = rules.filter(r =>
            r.pattern?.toString().includes('λ') ||
            r.pattern?.toString().includes('lambda')
        );
        console.log('Lambda rules found:', lambdaRules.length);
        lambdaRules.forEach(r => {
            console.log('  Pattern:', r.pattern?.toString());
            console.log('  Result:', r.result?.toString());
        });

        // Try manual unification
        if (lambdaRules.length > 0) {
            const rule = lambdaRules[0];
            console.log('\n=== Manual Unification Test ===');
            console.log('Pattern:', rule.pattern?.toString());
            console.log('Application:', app.toString());

            const bindings = Unify.unify(rule.pattern, app);
            console.log('Bindings:', bindings);

            if (bindings) {
                console.log('Substituted result:', Unify.subst(rule.result, bindings)?.toString());
            }
        }

        // Try actual reduction
        console.log('\n=== Actual Reduction ===');
        const result = interpreter.evaluate(app);
        console.log('Result:', result.toString());
        console.log('Expected: 5');
        console.log('Match:', result.toString() === '5');
    });

    test('check all space rules for lambda patterns', () => {
        const allRules = interpreter.space.getRules();
        console.log('\n=== All Rules in Space ===');
        console.log('Total rules:', allRules.length);

        const lambdaRules = allRules.filter(r => {
            const patternStr = r.pattern?.toString() || '';
            return patternStr.includes('λ') || patternStr.includes('lambda');
        });

        console.log('\n=== Lambda Rules ===');
        console.log('Count:', lambdaRules.length);
        lambdaRules.forEach((r, i) => {
            console.log(`\nRule ${i}:`);
            console.log('  Pattern:', r.pattern?.toString());
            console.log('  Result:', r.result?.toString());
            console.log('  Pattern type:', r.pattern?.type);
            console.log('  Pattern operator:', r.pattern?.operator?.toString());
        });
    });

    test('test &subst directly vs lambda pattern', () => {
        console.log('\n=== Direct &subst Test ===');
        const directResult = interpreter.run('(^ &subst $x 5 $x)');
        console.log('Direct &subst result:', directResult[0]?.toString());

        console.log('\n=== Lambda Application Test ===');
        const lambdaResult = interpreter.run('((λ $x $x) 5)');
        console.log('Lambda result:', lambdaResult[0]?.toString());

        console.log('\n=== Comparison ===');
        console.log('Both should be "5"');
        console.log('Direct works:', directResult[0]?.name === '5');
        console.log('Lambda works:', lambdaResult[0]?.name === '5');
    });
});
