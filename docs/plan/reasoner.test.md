✦ Refined Plan for End-to-End Testing and Hybrid NAL/LM Rule Examples

Phase 1: Pipeline Integration Testing

1.1 Core Pipeline Flow Test

1 // Test the complete continuous pipeline as specified in PLAN.reasoner.md:
2 // PremiseSource -> Strategy -> RuleProcessor -> Output Stream
3 - Verify continuous stream generation and consumption
4 - Test premise pairing with both NAL and LM rules ready
5 - Verify RuleProcessor dispatches to both sync (NAL) and async (LM) rules
6 - Confirm unified output stream includes results from both rule types
7 - Test CPU Throttle functionality doesn't block async operations

1.2 Derivation Depth Limit Enforcement

1 // Test derivation depth tracking and limits as specified in PLAN.reasoner.md
2 - Verify Stamp objects track depth correctly across rule types
3 - Test tasks are discarded when depth exceeds maxDerivationDepth
4 - Verify depth calculation includes both NAL and LM derivation steps
5 - Test continuous operation continues after depth limits enforced

1.3 Strategy Compatibility Test

1 // Test with different Strategy implementations mentioned in PLAN.reasoner.md:
2 - BagStrategy: Verify mixed NAL/LM rule execution with anytime reasoning
3 - ExhaustiveStrategy: Test comprehensive rule application to premise pairs
4 - ResolutionStrategy: Verify goal-driven execution works with hybrid rules

Phase 2: Hybrid Reasoning End-to-End Tests

2.1 Goal Decomposition with Follow-up Analysis

1 // Real end-to-end example: Complex goal processing
2 Input: High-priority goal task <WriteReport!>
3 1. PremiseSource: Samples the goal from Focus
4 2. Strategy: Pairs with relevant beliefs
5 3. LM Rule: Decompose goal into <ResearchTopic!>, <CreateOutline!>, <WriteDraft!>
6 4. NAL Rule: Apply deduction to sub-goals and existing beliefs
7 5. LM Rule: Generate explanations for deductions
8 Output: Stream of sub-goals, deductions, and explanations

2.2 Belief Consistency and Revision Flow

1 // Real end-to-end example: Belief management
2 Input: Set of beliefs including potential contradictions
3 1. PremiseSource: Provides beliefs for consistency checking
4 2. Strategy: Forms pairs for contradiction detection
5 3. NAL Rule: Detect potential contradictions
6 4. LM Rule: Suggest belief revisions
7 5. NAL Rule: Validate logical consistency of revisions
8 Output: Stream of detected contradictions, revisions, and validations

2.3 Hypothesis Generation and Testing

1 // Real end-to-end example: Scientific reasoning
2 Input: Observational belief and question
3 1. PremiseSource: Samples relevant beliefs and questions
4 2. Strategy: Pairs observations with questions
5 3. LM Rule: Generate testable hypotheses
6 4. NAL Rule: Attempt to confirm/disconfirm hypotheses
7 5. LM Rule: Explain results and suggest follow-up
8 Output: Stream of hypotheses, confirmations, and explanations

Phase 3: Resource Constraint Testing

3.1 AIKR Compliance Verification

1 // Test compliance with Assumption of Insufficient Knowledge and Resources (AIKR)
2 - Verify finite derivation graph through depth limits
3 - Test CPU Throttle prevents blocking while maintaining throughput
4 - Verify non-blocking async rule execution
5 - Test graceful handling of resource constraints

3.2 Continuous Operation Testing

1 // Test long-running operation as specified in PLAN.reasoner.md:
2 - Verify system operates continuously without degradation
3 - Test memory stability over extended periods
4 - Verify output stream remains healthy
5 - Test error recovery maintains continuous operation

Phase 4: Self-Optimization Hooks Testing

4.1 Sampling Objective Testing

1 // Test sampling objectives mentioned in PLAN.reasoner.md:
2 - Priority-based sampling: Verify high-priority tasks processed more frequently
3 - Recency-based sampling: Test recently activated tasks get attention
4 - Punctuation-based sampling: Verify goals/questions get appropriate focus
5 - Novelty-based sampling: Test less-processed tasks get attention

4.2 Credit Assignment Readiness

1 // Test derivation graph structure supports future credit assignment:
2 - Verify Stamp objects properly record derivation chains
3 - Test derivation depth tracking works correctly
4 - Verify rule execution logging is complete
5 - Test attribution information is preserved

Phase 5: Hybrid Rule Examples Implementation

5.1 Implement Representative Examples

    1 // Create 3 comprehensive examples that demonstrate full pipeline:
    2 Example 1: "Goal-Oriented Problem Solving"
    3   - Input: <SolveComplexProblem!>  
    4   - Process: LM decomposition → NAL validation → LM explanation
    5   - Output: Sub-goals, validations, explanations
    6 
    7 Example 2: "Belief Integration and Revision"  
    8   - Input: Set of potentially contradictory beliefs
    9   - Process: NAL contradiction detection → LM revision → NAL validation

10 - Output: Detected issues, revisions, validations
11
12 Example 3: "Hypothesis Formation and Testing"
13 - Input: Observation + Question
14 - Process: LM hypothesis generation → NAL confirmation → LM analysis
15 - Output: Hypotheses, confirmations, analyses

5.2 Pipeline Verification for Each Example

1 // For each example, verify the complete pipeline:
2 - PremiseSource correctly samples input tasks
3 - Strategy properly pairs premises for the scenario
4 - RuleExecutor efficiently selects appropriate rules
5 - RuleProcessor handles sync/async rule execution
6 - Output stream contains expected results
7 - Resource constraints respected throughout

Phase 6: Integration and Validation

6.1 Focus Integration Test

1 // Test integration with Focus component as specified in implementation notes:
2 - Verify TaskBagPremiseSource samples from Focus correctly
3 - Test derived tasks are added back to Focus
4 - Verify priority-based sampling works with hybrid rules
5 - Test attention buffer maintains relevant tasks for reasoning

6.2 System Feedback Loop Test

1 // Test the complete feedback loop: Output → Focus → PremiseSource → Processing
2 - Verify derived tasks feed back into reasoning cycle
3 - Test task prioritization updates based on derivation results  
4 - Verify system maintains "anytime" reasoning capability
5 - Test continuous learning through derivation chains

Testing Principles (Refined)

Minimize Brittle Tests

- Focus on observable pipeline behavior: input tasks → output stream
- Test component contracts rather than internal implementations
- Verify end-to-end functionality rather than intermediate states
- Use flexible assertions that tolerate reasonable implementation variations

Minimal Mock Usage

- Only mock the Language Model with canned responses for test efficiency
- Use real NAL rules, Strategy implementations, and system components
- Avoid mocking core pipeline components (PremiseSource, RuleProcessor, etc.)
- Only mock external dependencies if absolutely necessary for test isolation

Pipeline-Centric Testing

- Verify continuous, non-blocking pipeline operation
- Test that hybrid rules integrate smoothly into stream processing
- Verify all PLAN.reasoner.md architectural requirements are met
- Focus on system-level behavior rather than component-level optimization

This refined plan ensures comprehensive testing of the complete hybrid NAL/LM pipeline while
maintaining compatibility with the stream-based architecture specified in PLAN.reasoner.md. The
approach focuses on end-to-end functionality verification rather than premature optimization,
with minimal mock usage and emphasis on pipeline-level testing.

