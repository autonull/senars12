/**
 * Test Framework - Declarative DSL for NARS12 reasoning tests
 */

export type {
  ExpectedDerivation,
  Premise,
  TestResult,
  TestSpec,
} from './ReasoningTestBuilder.js';
export {
  assertReasoning,
  createPremise,
  describeReasoning,
  expectDerivation,
  ReasoningTestBuilder,
  testReasoning,
} from './ReasoningTestBuilder.js';
