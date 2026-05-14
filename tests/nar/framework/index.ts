/**
 * Test Framework - Declarative DSL for NARS12 reasoning tests
 */

export {
    assertReasoning,
    describeReasoning,
    createPremise,
    expectDerivation,
    testReasoning,
    ReasoningTestBuilder
} from './ReasoningTestBuilder.js';

export type {
    Premise,
    ExpectedDerivation,
    TestSpec,
    TestResult
} from './ReasoningTestBuilder.js';
