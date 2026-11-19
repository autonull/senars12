#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import globPkg from 'glob';
const { glob } = globPkg;

const files = glob.sync('src/**/*.ts', { ignore: ['**/tests/**', '**/*.d.ts'] });

const replacements = [
  // @senars/core/schemas/* -> @senars/schemas
  [/@senars\/core\/schemas\/cognitive-events/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/derivation-records/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/formalization/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/gate-io/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/governance/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/reasoning-budget/g, '@senars/schemas'],
  [/@senars\/core\/schemas\/truth/g, '@senars/schemas'],
  [/@senars\/core\/schemas/g, '@senars/schemas'],
  
  // @senars/core/* -> new paths
  [/@senars\/core\/budget/g, '@senars/budget'],
  [/@senars\/core\/cortex/g, '@senars/cortex'],
  [/@senars\/core\/engine\/base/g, '@senars/engine'],
  [/@senars\/core\/engine/g, '@senars/engine'],
  [/@senars\/core\/event-sink/g, '@senars/agent'],
  [/@senars\/core\/memory/g, '@senars/memory'],
  [/@senars\/core\/metta-port/g, '@senars/agent'],
  [/@senars\/core\/motor/g, '@senars/motor'],
  [/@senars\/core\/verify-derivation/g, '@senars/verification'],
  [/@senars\/core\/bridge\/chat-stream-handler/g, '@senars/bridge'],
  [/@senars\/core\/agent/g, '@senars/agent'],
];

// Special handling for @senars/core (root) - need to check what's imported
function fixCoreRootImport(content, filePath) {
  // Match: import { ... } from '@senars/core';
  const coreImportRegex = /import\s+{([^}]+)}\s+from\s+['"]@senars\/core['"];?/g;
  
  return content.replace(coreImportRegex, (match, imports) => {
    const importedItems = imports.split(',').map(s => s.trim()).filter(Boolean);
    const newImports = new Map();
    
    for (const item of importedItems) {
      const name = item.split(' as ')[0].trim();
      const alias = item.includes(' as ') ? item.split(' as ')[1].trim() : null;
      
      // Map each import to its new location
      let newPath = null;
      switch (name) {
        case 'Agent':
        case 'PromptBuilder':
        case 'CortexSynthesizeRequest':
        case 'Derivation':
        case 'ChatOptions':
        case 'ChatStreamEvent':
        case 'NARConfig':
        case 'RLFPConfig':
        case 'createBotNAR':
        case 'createMinimalNAR':
        case 'createNAR':
        case 'createTestNAR':
        case 'NAREventMap':
          newPath = '@senars/agent';
          break;
        case 'BaseComponent':
          newPath = '@senars/types';
          break;
        case 'ApprovalService':
          newPath = '@senars/agent';
          break;
        case 'createCortexFromLM':
          newPath = '@senars/cortex';
          break;
        case 'registerAgentTools':
        case 'dispatchToolCalls':
          newPath = '@senars/motor';
          break;
        case 'SOURCE_QUALITY_CONFIDENCE':
          newPath = '@senars/schemas';
          break;
        case 'PersistableSessionManager':
        case 'JsonlSessionManagerConfig':
        case 'abortSession':
        case 'createSession':
        case 'InMemorySessionManager':
        case 'JsonlSessionManager':
          newPath = '@senars/memory';
          break;
        case 'MettaPort':
          newPath = '@senars/agent';
          break;
        case 'KernelControlState':
        case 'CognitiveEvent':
          newPath = '@senars/schemas';
          break;
        case 'verifyRecord':
          newPath = '@senars/verification';
          break;
        case 'RewardGateOutput':
          newPath = '@senars/schemas';
          break;
        default:
          console.warn(`Unknown @senars/core import: ${name} in ${filePath}`);
          newPath = '@senars/core'; // keep as is for now
      }
      
      if (newPath) {
        const key = newPath;
        if (!newImports.has(key)) newImports.set(key, []);
        newImports.get(key).push(item);
      }
    }
    
    // Build new import statements
    const newStatements = [];
    for (const [path, items] of newImports) {
      newStatements.push(`import { ${items.join(', ')} } from '${path}';`);
    }
    
    return newStatements.join('\n');
  });
}

let totalChanges = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let originalContent = content;
  
  // Apply simple replacements
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  
  // Apply special handling for @senars/core root imports
  content = fixCoreRootImport(content, file);
  
  if (content !== originalContent) {
    writeFileSync(file, content, 'utf-8');
    totalChanges++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`\nTotal files changed: ${totalChanges}`);