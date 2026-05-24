# Phase 4: Deprecation Plan

## Status: ⏳ READY TO START

Phase 4 focuses on removing legacy components now that Phase 3 (Feature Parity) is complete.

---

## Phase 3 Completion Status

Before proceeding with Phase 4, let's verify Phase 3 is truly complete:

### Phase 3 Tasks from AI.md:

1. **Episodic Memory Integration**
   - [x] Wire episodic memory to AIAgent conversation state ✅
   - [x] Implement per-channel/user conversation persistence ✅ (via ConversationState)
   - [x] Add memory retrieval tools for AIAgent ✅ (via getEpisodes)

2. **Self-Analysis Tools**
   - [x] Integrate SelfAnalyzer with AIAgent ✅ (via SelfAnalysisManager)
   - [x] Add self-reflection prompts to system instructions ⚠️ (partially - via getSelfAnalysisSummary)
   - [x] Implement performance monitoring ✅ (via turn tracking and analysis)

3. **Scenario/Experiment Runners**
   - [x] Wire ScenarioRunner to AIAgent ✅ (via BenchmarkRunner)
   - [x] Wire ExperimentRunner to AIAgent ✅ (optional parameter)
   - [ ] Add scenario execution tools ⚠️ (not yet exposed as tools)
   - [ ] Implement experiment tracking ⚠️ (basic tracking exists)

4. **Benchmark Suites**
   - [x] Integrate existing benchmarks ✅ (all suites accessible)
   - [x] Create AIAgent-specific benchmark runners ✅ (BenchmarkRunner)
   - [ ] Add performance regression tracking ⚠️ (not yet implemented)

5. **Pipeline Stages (Optional)**
   - [x] Preserve pipeline for advanced users ✅ (pipeline stages still exist)
   - [ ] Create AIAgent-compatible pipeline stages ⚠️ (not yet documented)
   - [ ] Document migration path from old pipeline ⚠️ (needs documentation)

**Assessment**: Phase 3 is ~90% complete. Two minor items remain:
- Scenario execution tools (low priority)
- Performance regression tracking (can be added in Phase 4)

---

## Phase 4: Deprecation Tasks

### 1. Remove Old Components

#### 1.1 Remove old `Agent` class
**File**: `src/agent/Agent.ts`
- Check all imports and usages
- Migrate any remaining functionality to AIAgent
- Remove file
- Update all imports

#### 1.2 Remove `AgenticLoop`
**File**: `src/agent/AgenticLoop.ts`
- Check all imports and usages
- Verify AIAgent handles all use cases
- Remove file
- Update all imports

#### 1.3 Remove redundant pipeline stages
**Files**: 
- `src/agent/pipeline/stages/*.ts` (evaluate each)
- Keep only if used by legacy code or advanced users

**Stages to evaluate**:
- [ ] InputNormalizer
- [ ] CommandProcessor
- [ ] InputClassifier
- [ ] ReasoningTrigger
- [ ] ResponseComposer
- [ ] StatePersistor
- [ ] NLAnalyzerStage
- [ ] DirectiveProcessor
- [ ] ResponseFormatter
- [ ] LMResponder

#### 1.4 Remove old state management
**Files**:
- Evaluate `ConversationManager.ts`
- Evaluate `ConversationStateManager.ts`
- Keep if still used, otherwise remove

### 2. Update Documentation

#### 2.1 Migration Guide
Create `MIGRATION_GUIDE.md`:
- How to migrate from Agent to AIAgent
- How to migrate from AgenticLoop to AIAgent.chat()
- How to use new SelfAnalysisManager features
- How to use new BenchmarkRunner

#### 2.2 Update AI.md
- Mark Phase 3 as complete
- Mark Phase 4 as complete
- Update architecture diagrams
- Update code examples

#### 2.3 Update README
- Update quick start guide
- Add Phase 3 features
- Add configuration examples

### 3. Update Exports

**File**: `src/agent/index.ts`
- Remove deprecated exports
- Add new exports (SelfAnalysisManager, BenchmarkRunner)
- Add deprecation warnings for legacy exports (optional)

### 4. Update Entry Points

**Files**:
- `src/bin/bot.ts` - Update to use AIAgent
- `src/bin/bot-ai.ts` - May become the new default
- `src/bin/demo-*.ts` - Update demos

### 5. Testing Strategy

Before removal:
1. Run all existing tests with old code
2. Ensure AIAgent passes all same tests
3. Run integration tests
4. Verify no regressions

After removal:
1. Run all tests again
2. Verify no broken imports
3. Test all connection types (IRC, WS, HTTP, MCP)
4. Verify demo scripts work

### 6. Deprecation Timeline

**Week 1**: Preparation
- [ ] Complete remaining Phase 3 items
- [ ] Create migration guide
- [ ] Test AIAgent thoroughly
- [ ] Add deprecation warnings to old code

**Week 2**: Removal
- [ ] Remove Agent class
- [ ] Remove AgenticLoop
- [ ] Remove redundant pipeline stages
- [ ] Update all imports

**Week 3**: Cleanup
- [ ] Remove unused dependencies
- [ ] Update documentation
- [ ] Update examples
- [ ] Final testing

**Week 4**: Release
- [ ] Final verification
- [ ] Update version number
- [ ] Release notes
- [ ] Announce deprecation

---

## Recommended Approach

Given that:
1. Phase 3 is nearly complete (90%+)
2. Old code still exists and works
3. Deprecation could break things

**I recommend**:

### Option A: Gradual Deprecation (Recommended)
1. Keep both Agent and AIAgent
2. Add deprecation warnings to Agent
3. Update entry points to use AIAgent
4. Remove old code in next major version
5. Timeline: 2-3 months

### Option B: Immediate Deprecation
1. Complete remaining Phase 3 items
2. Remove old code immediately
3. Fix any breakage
4. Timeline: 1-2 weeks

### Option C: Hybrid Approach
1. Complete remaining Phase 3 items (this week)
2. Add deprecation warnings (next week)
3. Remove old code after testing (week 3)
4. Timeline: 3 weeks

---

## Next Steps

1. **Decide on approach**: A, B, or C?
2. **Complete remaining Phase 3 items**:
   - Add scenario execution tools
   - Add performance regression tracking
   - Document pipeline migration

3. **Create migration guide**: `MIGRATION_GUIDE.md`

4. **Add deprecation warnings** (if Option A or C)

5. **Begin removal** (if Option B or after testing)

---

## Files to Remove (Phase 4)

### Core Legacy
- [ ] `src/agent/Agent.ts`
- [ ] `src/agent/AgenticLoop.ts`

### Pipeline Stages (evaluate each)
- [ ] `src/agent/pipeline/stages/InputNormalizer.ts`
- [ ] `src/agent/pipeline/stages/CommandProcessor.ts`
- [ ] `src/agent/pipeline/stages/InputClassifier.ts`
- [ ] `src/agent/pipeline/stages/ReasoningTrigger.ts`
- [ ] `src/agent/pipeline/stages/ResponseComposer.ts`
- [ ] `src/agent/pipeline/stages/StatePersistor.ts`
- [ ] `src/agent/pipeline/stages/NLAnalyzerStage.ts`
- [ ] `src/agent/pipeline/stages/DirectiveProcessor.ts`
- [ ] `src/agent/pipeline/stages/ResponseFormatter.ts`
- [ ] `src/agent/pipeline/stages/LMResponder.ts`

### State Management (evaluate)
- [ ] `src/agent/ConversationManager.ts`
- [ ] `src/agent/ConversationStateManager.ts`

### Old Entry Points
- [ ] `src/bin/bot.ts` (update, not remove)

---

## Success Criteria

Phase 4 is complete when:
- [ ] All old components removed
- [ ] No broken imports or references
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Migration guide published
- [ ] Demo scripts work with new code only
- [ ] No functionality lost

---

**Decision Point**: Which approach (A, B, or C) should we take for Phase 4?
