#!/usr/bin/env tsx
/**
 * Migration script to update test imports from legacy @senars/* packages
 * to new src/ path aliases.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
const TEST_DIR = '/home/me/senars12/tests';

// Comprehensive import mappings
const IMPORT_MAP: Record<string, string> = {
  // @senars/util -> @senars/utils
  "@senars/util": "@senars/utils",
  "@senars/util/commands": "@senars/utils",
  "@senars/util/config": "@senars/utils",
  "@senars/util/errors": "@senars/utils",
  "@senars/util/events": "@senars/utils",
  "@senars/util/ledger": "@senars/utils",
  "@senars/util/memory": "@senars/utils",
  "@senars/util/types/memory": "@senars/utils",
  "@senars/util/types/transport": "@senars/utils",
  "@senars/util/utils/assert": "@senars/utils",
  "@senars/util/utils/eval": "@senars/utils",
  // @senars/io -> @senars/transport
  "@senars/io": "@senars/transport",
  "@senars/io/connections/cli": "@senars/transport",
  "@senars/io/connections/ws": "@senars/transport",
  "@senars/io/connections/reply-target": "@senars/transport",
  // @senars/metta -> @senars/metta-runtime
  "@senars/metta": "@senars/metta-runtime",
  "@senars/metta/agent": "@senars/metta-runtime",
  "@senars/metta/engine/MettaEngine": "@senars/metta-runtime",
  // @senars/nar -> @senars/agent (main) and specific barrels
  "@senars/nar": "@senars/agent",
  "@senars/nar/agent": "@senars/agent",
  "@senars/nar/terms": "@senars/terms",
  "@senars/nar/lm": "@senars/lm",
  "@senars/nar/metrics": "@senars/metrics",
  "@senars/nar/reflex": "@senars/reflex",
  "@senars/nar/rules": "@senars/rules",
  "@senars/nar/self": "@senars/self",
  "@senars/nar/dialogue": "@senars/dialogue",
  "@senars/nar/health": "@senars/health",
  "@senars/nar/focus": "@senars/focus",
  "@senars/nar/otel": "@senars/otel",
  "@senars/nar/kernel": "@senars/kernel",
  "@senars/nar/kernel/bag": "@senars/kernel",
  "@senars/nar/kernel/gate": "@senars/kernel",
  "@senars/nar/kernel/stamp": "@senars/kernel",
  "@senars/nar/kernel/step": "@senars/kernel",
  "@senars/nar/kernel/terms/canonical": "@senars/kernel",
  "@senars/nar/kernel/terms/intern": "@senars/kernel",
  "@senars/nar/kernel/truth": "@senars/kernel",
  "@senars/nar/kernel/replay": "@senars/kernel",
  "@senars/nar/kernel/replay-compat": "@senars/kernel",
  "@senars/nar/memory": "@senars/agent",
  "@senars/nar/memory/episodic": "@senars/agent",
  "@senars/nar/memory/retrieval-verified": "@senars/agent",
  "@senars/nar/memory/pressure": "@senars/kernel",
  "@senars/nar/memory/concept": "@senars/agent",
  "@senars/nar/bag": "@senars/kernel",
  "@senars/nar/bag/Bag": "@senars/kernel",
  "@senars/nar/engine": "@senars/kernel",
  "@senars/nar/engine/NAREngine": "@senars/kernel",
  "@senars/nar/tools": "@senars/agent",
  "@senars/nar/tools/impls/ToolManager": "@senars/agent",
  "@senars/nar/tools/adapters/web-search": "@senars/agent",
  "@senars/nar/nl": "@senars/nl",
  "@senars/nar/nl/understanding": "@senars/nl",
  "@senars/nar/nl/schemas": "@senars/nl",
  "@senars/nar/nl/firewall": "@senars/nl",
  "@senars/nar/lm/system-one": "@senars/lm",
  "@senars/nar/lm/system-one/resource-gate": "@senars/lm",
  "@senars/nar/lm/system-one/types": "@senars/lm",
  "@senars/nar/lm/rule/LMRule": "@senars/lm",
  "@senars/nar/lm/lm-service": "@senars/lm",
  "@senars/nar/terms/impls/Truth": "@senars/terms",
  "@senars/nar/terms/impls/factory": "@senars/terms",
  "@senars/nar/config/cognitive-parameters": "@senars/config/nar",
  "@senars/nar/facade/config": "@senars/agent",
  "@senars/nar/index": "@senars/agent",
  "@senars/nar/nar": "@senars/agent",
  "@senars/nar/capability": "@senars/agent",
  // @senars/core -> @senars/agent, @senars/memory
  "@senars/core": "@senars/agent",
  "@senars/core/memory": "@senars/memory",
  "@senars/core/schemas": "@senars/agent",
  "@senars/core/engine": "@senars/kernel",
  "@senars/core/engine/base": "@senars/kernel",
  "@senars/core/eventlog": "@senars/log",
  "@senars/core/budget": "@senars/budget",
  "@senars/core/budget-resources": "@senars/budget",
  "@senars/core/budget-events": "@senars/budget",
  "@senars/core/protocol": "@senars/agent",
  // @senars/kernel -> @senars/kernel (new)
  "@senars/kernel": "@senars/kernel",
  // @senars/lm -> @senars/lm (new)
  "@senars/lm": "@senars/lm",
  // @senars/utils/config -> @senars/utils (already covered)
  "@senars/utils/config": "@senars/utils",
  // @senars/ui/* -> keep as is (ui package not being consolidated yet)
  // Additional @senars/nar subpaths
  "@senars/nar/nar.js": "@senars/agent",
  "@senars/nar/index.js": "@senars/agent",
  "@senars/nar/nar-execution.js": "@senars/agent",
  "@senars/nar/nar-execution": "@senars/agent",
  "@senars/nar/kernel/index.js": "@senars/kernel",
  "@senars/nar/kernel/KernelBudgetGate": "@senars/kernel",
  "@senars/nar/kernel/KernelPerceptionGate.js": "@senars/kernel",
  "@senars/nar/kernel/control-budgets": "@senars/kernel",
  "@senars/nar/kernel/budget-scopes": "@senars/kernel",
  "@senars/nar/kernel/source-reputation.js": "@senars/kernel",
  "@senars/nar/kernel/reputation-keys.js": "@senars/kernel",
  "@senars/nar/kernel/GateRegistry": "@senars/kernel",
  "@senars/nar/memory/memory.js": "@senars/agent",
  "@senars/nar/memory/EpisodicMemory.js": "@senars/agent",
  "@senars/nar/memory/pressure/index.js": "@senars/kernel",
  "@senars/nar/memory/concept.js": "@senars/agent",
  "@senars/nar/memory/config.js": "@senars/agent",
  "@senars/nar/memory/episode-consolidator.js": "@senars/agent",
  "@senars/nar/memory/embedding": "@senars/agent",
  "@senars/nar/memory/links": "@senars/agent",
  "@senars/nar/memory/associative": "@senars/agent",
  "@senars/nar/bag/Bag.js": "@senars/kernel",
  "@senars/nar/tools/schemas": "@senars/agent",
  "@senars/nar/dialogue/index.js": "@senars/dialogue",
  "@senars/nar/dialogue/impls/retrospect.js": "@senars/dialogue",
  "@senars/nar/terms/impls/Truth.js": "@senars/terms",
  "@senars/nar/terms/impls/factory.js": "@senars/terms",
  "@senars/nar/terms/types.js": "@senars/terms",
  "@senars/nar/focus/Focus.js": "@senars/focus",
  "@senars/nar/focus/FocusBag.js": "@senars/focus",
  "@senars/nar/focus/episode-schemas": "@senars/focus",
  "@senars/nar/drives/index.js": "@senars/agent",
  "@senars/nar/config/parameter-table.js": "@senars/config/nar",
  "@senars/nar/cognitive/impls/CognitiveRegistry.js": "@senars/agent",
  "@senars/nar/cognitive/impls/CognitiveController.js": "@senars/agent",
  "@senars/nar/reflex/Negotiator.js": "@senars/reflex",
  "@senars/nar/reflex/Reflex.js": "@senars/reflex",
  "@senars/nar/reflex/weighted-quorum.js": "@senars/reflex",
  "@senars/nar/reflex/TabularQReflex.js": "@senars/reflex",
  "@senars/nar/reflex/negotiation-types.js": "@senars/reflex",
  "@senars/nar/proposal/lifecycle.js": "@senars/agent",
  "@senars/nar/proposal/stages.js": "@senars/agent",
  "@senars/nar/proposal/lm-rule-producer.js": "@senars/agent",
  "@senars/nar/proposal/lm-rule-producer": "@senars/agent",
  "@senars/nar/ports": "@senars/agent",
  "@senars/nar/nl/firewall.js": "@senars/nl",
  "@senars/nar/meta/proposal-bag.js": "@senars/agent",
  "@senars/nar/game/impls/TicTacToe.js": "@senars/agent",
  "@senars/nar/game/impls/TetrisGame.js": "@senars/agent",
  "@senars/nar/game/impls/SnakeGame.js": "@senars/agent",
  "@senars/nar/game/impls/SelfMetaGame.js": "@senars/agent",
  "@senars/nar/game/impls/GridWorldGame.js": "@senars/agent",
  "@senars/nar/game/impls/Game2048.js": "@senars/agent",
  "@senars/nar/game": "@senars/agent",
  "@senars/nar/eval/arcade-trace": "@senars/agent",
  "@senars/nar/learning/aikr-processor.js": "@senars/agent",
  "@senars/nar/strategies/premise/term-link.js": "@senars/agent",
  "@senars/nar/strategies/lm-graph/RuleGraph.js": "@senars/agent",
  "@senars/nar/strategies/attention/CompositeAttention.js": "@senars/agent",
  "@senars/nar/strategies/attention/NullAttentionModel": "@senars/agent",
  "@senars/nar/strategies/sampling/CompositeSampling.js": "@senars/agent",
  "@senars/nar/strategies/premise/selection-strategies.js": "@senars/agent",
  "@senars/nar/strategies/premise": "@senars/agent",
  "@senars/nar/strategies/lm-selectors/CompositeLMRuleSelector.js": "@senars/agent",
  "@senars/nar/strategies/types": "@senars/agent",
  "@senars/nar/strategies": "@senars/agent",
  "@senars/nar/rules/types": "@senars/rules",
  "@senars/nar/rules/impls/RuleIndex": "@senars/rules",
  "@senars/nar/rules/impls/recorder.js": "@senars/rules",
  "@senars/nar/rules/impls/ranking.js": "@senars/rules",
  "@senars/nar/lm/system-one/types.js": "@senars/lm",
  "@senars/nar/lm/system-one/decide.js": "@senars/lm",
  "@senars/nar/lm/system-one/embedding-cache.js": "@senars/lm",
  "@senars/nar/lm/system-one/embedding-cache": "@senars/lm",
  "@senars/nar/lm/system-one/hard-negatives.js": "@senars/lm",
  "@senars/nar/lm/system-one/verify.js": "@senars/lm",
  "@senars/nar/lm/system-one/seed.js": "@senars/lm",
  "@senars/nar/lm/system-one/rule-adapter": "@senars/lm",
  "@senars/nar/lm/system-one/open-systemone-manifold.js": "@senars/lm",
  "@senars/nar/lm/system-one/manifold-reflex": "@senars/lm",
  "@senars/nar/lm/system-one/manifold.js": "@senars/lm",
  "@senars/nar/lm/system-one/manifold": "@senars/lm",
  "@senars/nar/lm/system-one/lm-reflex.js": "@senars/lm",
  "@senars/nar/lm/system-one/ingress-judge.js": "@senars/lm",
  "@senars/nar/lm/system-one/groundedness-gate.js": "@senars/lm",
  "@senars/nar/lm/system-one/distill.js": "@senars/lm",
  "@senars/nar/lm/system-one/distill": "@senars/lm",
  "@senars/nar/lm/system-one/dispatcher.js": "@senars/lm",
  "@senars/nar/lm/system-one/cortex-adapter.js": "@senars/lm",
  "@senars/nar/lm/system-one/cortex-adapter": "@senars/lm",
  "@senars/nar/lm/system-one/contrastive.js": "@senars/lm",
  "@senars/nar/lm/system-one/cascade-reflex.js": "@senars/lm",
  "@senars/nar/lm/system-one/calibration-fit": "@senars/lm",
  "@senars/nar/lm/system-one/action-grammar.js": "@senars/lm",
  "@senars/nar/lm/system-one/policy": "@senars/lm",
  "@senars/nar/lm/system-one/resource-gate.js": "@senars/lm",
  "@senars/nar/lm/rule/LMRule.js": "@senars/lm",
  "@senars/nar/lm/lm-service.js": "@senars/lm",
  "@senars/nar/lm/json.js": "@senars/lm",
  "@senars/nar/lm/shadow-validation.js": "@senars/lm",
  "@senars/nar/lm/enrichment": "@senars/lm",
  "@senars/nar/stream": "@senars/agent",
  "@senars/nar/stream/reasoner.js": "@senars/agent",
  // @senars/metta subpaths
  "@senars/metta-runtime": "@senars/metta-runtime",
  // @senars/util legacy subpaths
  "@senars/util/side-effect.js": "@senars/utils",
};

// Function to get all test files
function getTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getTestFiles(fullPath));
    } else if (extname(entry) === '.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

// Function to migrate a single file
function migrateFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace static imports: import ... from '...'
  for (const [legacyPath, newPath] of Object.entries(IMPORT_MAP)) {
    const legacyEscaped = legacyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`from\\s+['"]${legacyEscaped}['"]`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `from '${newPath}'`);
      changed = true;
    }
  }

  // Replace dynamic imports: import('...')
  for (const [legacyPath, newPath] of Object.entries(IMPORT_MAP)) {
    const legacyEscaped = legacyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`import\\(['"]${legacyEscaped}['"]\\)`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `import('${newPath}')`);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Migrated: ${filePath}`);
  }
  return changed;
}

// Main
const testFiles = getTestFiles(TEST_DIR);
console.log(`Found ${testFiles.length} test files`);
let migratedCount = 0;
for (const file of testFiles) {
  if (migrateFile(file)) {
    migratedCount++;
  }
}
console.log(`Migrated ${migratedCount} files`);