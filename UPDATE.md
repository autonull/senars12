# NAL+LM Cognitive Synergy System - Complete Design

## Core Philosophy
**One input, unified processing, synergistic output.**

The system treats every input as potentially requiring both semantic understanding (LM) and logical reasoning (NARS). The question is never "which one handles this?" but "how do they collaborate?"

---

## Unified Data Flow

```
INPUT (any form)
  ↓
STAGE 1: Context Builder
  - Extract conversation history (max 10 turns)
  - Get attention report from NARS (top 20 concepts)
  - Identify active topics
  - Build context snapshot for LM
  ↓
STAGE 2: LM Semantic Interpreter
  Input: {raw text, context snapshot}
  
  LM analyzes and returns structured output:
  {
    intent: 'statement' | 'question' | 'goal' | 'command',
    confidence: 0.0-1.0,
    keyTerms: string[],
    suggestedNarsese?: string,    // if belief to add
    suggestedQuery?: string,      // if query to ask
    suggestedGoal?: string,       // if goal to pursue
    semanticContext: string,      // for response
    requiresReasoning: boolean,   // trigger NARS?
    reasoningDepth: number        // how deep to go
  }
  ↓
  ┌─────────────────────┴──────────────────────┐
  ↓                                           ↓
STAGE 3a: NARS Engine                    STAGE 3b: LM Direct
If LM suggests NARS ops                  If LM says no NARS needed
  - Add beliefs                            LM generates response
  - Ask queries                            using semantic context
  - Pursue goals                           No NARS interaction
  - Run inference
  Returns:                                 Returns:
  - Derivation results                     - Conversational response
  - Query answers                          - Acknowledgment
  - Updated attention
  ↓                                           ↓
  └─────────────────────┬──────────────────────┘
                        ↓
STAGE 4: Response Synthesizer
  Input: {LM interpretation, NARS results}
  
  If NARS ran:
    - Interpret derivation trace
    - Explain in natural language
    - Cite sources (which beliefs led to conclusion)
  
  If LM-only:
    - Use semanticContext for response
    - Maintain conversational flow
  
  Output: Natural, contextually-aware response
  ↓
STAGE 5: State Update
  - Add new beliefs to conversation history
  - Update NARS attention based on interaction
  - Persist episodic memory if enabled
```

---

## Component Details

### Stage 1: Context Builder
**Purpose**: Gather all relevant context for interpretation

**Inputs**:
- Raw user input
- Current conversation state
- NARS memory state

**Outputs**:
```typescript
interface ContextSnapshot {
  history: Message[];           // Last N turns
  attention: {
    concepts: {term: string, priority: number}[];
    focusTerms: string[];
  };
  recentDerivations: Derivation[];
  mode: 'chat' | 'reason' | 'auto';
}
```

### Stage 2: LM Semantic Interpreter
**Purpose**: Understand meaning, suggest operations

**Prompt Structure**:
```
You are interpreting user input for a cognitive system.

CONTEXT:
- Recent conversation: {history summary}
- Active concepts: {top NARS concepts by attention}
- System mode: {chat/reason/auto}

INPUT: "{user input}"

Respond in JSON:
{
  "intent": "statement|question|goal|command",
  "confidence": 0.0-1.0,
  "keyTerms": ["term1", "term2"],
  "suggestedNarsese": "(term --> property).",  // if applicable
  "suggestedQuery": "(term --> ?1)?",          // if question
  "semanticContext": "User is asking about...",
  "requiresReasoning": true/false,
  "reasoningDepth": 3
}
```

### Stage 3a: NARS Engine
**Purpose**: Execute symbolic operations

**Operations**:
- `believe(narsese)`: Add belief with truth values
- `query(narsese)`: Ask question, get answer with confidence
- `goal(narsese)`: Set goal, plan achievement
- `run(steps)`: Perform inference steps

**Outputs**:
```typescript
interface NARSResult {
  beliefs?: Belief[];
  queryAnswer?: {answer: string, confidence: number};
  derivations?: Derivation[];
  attentionUpdate?: AttentionChange;
}
```

### Stage 3b: LM Direct
**Purpose**: Handle purely conversational input

**When Used**:
- Greetings ("hello", "how are you")
- Clarifications ("what do you mean?")
- Meta-discussion ("can you do X?")
- LM confidence is high, NARS not needed

### Stage 4: Response Synthesizer
**Purpose**: Generate natural, informative responses

**Logic**:
```typescript
function synthesizeResponse(lm: LMInterpretation, nars?: NARSResult): string {
  if (nars) {
    if (nars.queryAnswer) {
      return formatQueryAnswer(nars.queryAnswer, lm.semanticContext);
    }
    if (nars.beliefs) {
      return ackowledgeBelief(nars.beliefs, lm.semanticContext);
    }
    if (nars.derivations) {
      return explainDerivation(nars.derivations, lm.semanticContext);
    }
  }
  return lm.semanticContext;
}
```

**Response Styles**:
- **Factual**: "Yes, Tweety can fly." (confidence > 0.8)
- **Tentative**: "Probably, Tweety can fly." (confidence 0.5-0.8)
- **Uncertain**: "I'm not sure if Tweety can fly." (confidence < 0.5)
- **Explanatory**: "Yes, because Tweety is a bird and birds can fly."

### Stage 5: State Update
**Purpose**: Maintain system state

**Updates**:
- Add user input to conversation history
- Add system response to conversation history
- Update NARS attention based on terms used
- Store episodic memory (if enabled)
- Update metrics (turns, response times, etc.)

---

## Implementation Phases

### Phase 1: Fix Immediate Issues (CURRENT)
- [x] Fix NL parser syntax
- [ ] Remove forced NL→Narsese translation
- [ ] Ensure queries route to LM, not parser
- [ ] Test: "All birds can fly", "Can Tweety fly?", "What are cats?"

### Phase 2: Implement Unified Flow
- [ ] Create ContextBuilder stage
- [ ] Implement LM Semantic Interpreter
- [ ] Simplify SeNARSProcessor to execute ops only
- [ ] Create Response Synthesizer

### Phase 3: Enable Synergy
- [ ] LM→NARS: structured operation suggestions
- [ ] NARS→LM: context, attention, derivations
- [ ] Bidirectional feedback loop

### Phase 4: Polish & Optimize
- [ ] Streaming responses
- [ ] Adaptive reasoning depth
- [ ] Interactive clarification
- [ ] Performance optimization

---

## Test Cases

### Passing ✅
1. "Tweety is a bird" → `(Tweety --> bird).` via NL parser
2. "Cats are mammals" → `(Cats --> (mammals)).` via NL parser

### Failing ❌ (Target of Phase 1)
1. "All birds can fly" → Should parse as universal
2. "Can Tweety fly?" → Should be LM query
3. "What are cats?" → Should be LM query

### Target Behavior (Phase 2+)
1. Deductive reasoning chain
2. LM-handled conversational queries
3. Uncertainty acknowledgment
4. Contextual follow-ups

---

## Success Metrics

- ✅ Zero parser errors exposed to users
- ✅ Natural handling of all NL input types
- ✅ Seamless NARS+LM collaboration
- ✅ Contextually appropriate responses
- ✅ Transparent reasoning when needed
- ✅ Ergonomic conversational flow
