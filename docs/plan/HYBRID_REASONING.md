# Hybrid LM-NAL Reasoning System

This document outlines the implementation of the hybrid reasoning system that combines Large Language Model (LLM)
commonsense knowledge with formal Non-Axiomatic Logic (NAL) reasoning in the SeNARS system.

## Overview

The hybrid reasoning system enables natural language input to be processed by LLMs and then integrated into the formal
NAL reasoning framework. This creates a powerful combination of neural language understanding and logical inference.

## Architecture Components

### 1. LM Rule Infrastructure (`src/reason/LMRule.js`)

- Extends traditional rules with asynchronous LLM capabilities
- Implements circuit breaker pattern for robust LLM operations
- Includes prompt templating and response processing
- Handles both single and dual premise reasoning

### 2. Core LM Rules (`src/reason/rules/lm/`)

- **NarseseTranslationRule**: Translates natural language to Narsese format
- **ConceptElaborationRule**: Generates properties/classifications for concepts
- **AnalogicalReasoningRule**: Draws analogies to solve new problems
- All rules follow the LMRule pattern with condition, prompt, process, and generate phases

### 3. Parser Integration (`src/parser/NarseseParser.js`)

- Handles Narsese syntax parsing
- Integrates with term factory for atomic and compound term creation
- Processes quoted strings as atomic terms for natural language input

### 4. Reasoning Engine (`src/reason/Reasoner.js`)

- Stream-based reasoning architecture
- Rule executor with candidate filtering
- Async rule processing capabilities
- Integration with LM components

## Implementation Flow

### Input Processing

1. Natural language input arrives as quoted strings: `"Cats are mammals"`.
2. Parser creates atomic terms from quoted strings
3. Reasoner detects relevant LM rules for atomic terms
4. LM rules generate prompts based on term content
5. LLM processes prompts and generates responses
6. Responses are processed and converted to Narsese tasks
7. Generated tasks join reasoning pool for further inference

### LM Rule Execution

Each LM rule implements four key functions:

- `condition`: Determines if rule applies to premises
- `prompt`: Generates LLM prompt from premise(s)
- `process`: Post-processes LLM response
- `generate`: Creates new tasks from processed output

## Key Files and Functions

### Core Infrastructure

- `src/reason/LMRule.js`: Base LM rule class with circuit breaker
- `src/reason/Reasoner.js`: Main reasoning loop
- `src/reason/RuleExecutor.js`: Rule candidate selection

### Specific Rules

- `src/reason/rules/lm/LMNarseseTranslationRule.js`: Natural language to Narsese translation
- `src/reason/rules/lm/LMConceptElaborationRule.js`: Concept expansion
- `src/reason/rules/lm/LMAnalogicalReasoningRule.js`: Analogy-based inference

### Parser

- `src/parser/narsese.peggy`: Grammar for Narsese with quoted strings
- `src/parser/NarseseParser.js`: Integration with term factory

## Error Handling & Robustness

- Circuit breaker pattern prevents cascading failures
- Fallback mechanisms when LLM is unavailable
- Graceful degradation to pure NAL reasoning
- Comprehensive error logging and recovery

## Integration Points

- NAR input: Natural language strings become atomic beliefs
- Task creation: LM responses generate new reasoning tasks
- Focus management: Generated tasks enter reasoning focus
- Rule interaction: LM-derived tasks participate in NAL reasoning

## Usage Example

```javascript
// Input natural language as quoted strings
await agent.input('"Cats are mammals".');
await agent.input('"Dogs are animals".');
await agent.input('"Are cats animals"?');

// The system will:
// 1. Parse quoted strings as atomic terms
// 2. Apply relevant LM rules
// 3. Generate new beliefs and concepts
// 4. Integrate with formal NAL reasoning
```

## Verification

The system has been thoroughly tested and verified to:

- Process natural language input correctly
- Create proper Term objects (not strings)
- Generate new reasoning tasks through LM rules
- Integrate with existing NAL reasoning
- Operate with error handling and circuit breaker patterns
- Support end-to-end hybrid reasoning scenarios