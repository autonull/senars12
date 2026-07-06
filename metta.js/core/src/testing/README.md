# Cycle-Limited Testing Framework for SeNARS

## Overview

This document describes the cycle-limited testing framework implemented to ensure reliable, finite test execution in
SeNARS, following the OpenNARS approach of specifying maximum cycle counts for tests.

## Problem Addressed

- Prevent infinite loops and hanging tests during development
- Ensure all tests complete in a predictable timeframe
- Maintain test reliability even when system features could cause infinite execution

## Solution

The cycle-limited testing utility ensures all tests complete within a specified maximum number of reasoning cycles,
following the OpenNARS pattern.

## Implementation

The framework provides core functions for running tests with cycle limits, returning structured results that include
success status, cycle count, and outcome messages. There's also a tester class for more complex tests with specific
success conditions, and specialized functions for different types of reasoning tests.

## Usage Guidelines

Simple tests that just need to ensure the system doesn't hang can specify a cycle limit and verify completion within
bounds. More complex tests with specific conditions can define custom success criteria that may complete early if
conditions are met.

## Benefits

1. **Guaranteed Termination**: All tests complete within defined cycle limits
2. **Infinite Loop Protection**: Prevents test suites from hanging
3. **Performance Awareness**: Makes performance implications visible
4. **Reliable CI/CD**: Ensures continuous integration doesn't hang
5. **OpenNARS Compatibility**: Follows established patterns from OpenNARS

## Migration Guidelines

To migrate existing tests to use cycle limits:

1. Replace direct NAR instantiation with the cycle-limited test framework
2. Specify appropriate cycle limits based on test complexity
3. Update assertions to check both success and cycle count
4. Consider using the tester utilities for complex scenarios with specific conditions

## Best Practices

- Choose realistic cycle limits based on test complexity
- Use lower limits for simple functional tests
- Use higher limits for complex reasoning scenarios
- Always assert on both success status and cycle count
- Ensure proper test cleanup
- Use appropriate specialized functions when available

## Cycle Limits by Test Type

- Simple functional tests: 5-15 cycles
- Basic inference tests: 15-30 cycles
- Complex reasoning tests: 30-100 cycles
- Performance analysis: As needed, with clear justification

This approach ensures that SeNARS tests remain reliable, predictable, and finite while maintaining the ability to test
complex reasoning scenarios.