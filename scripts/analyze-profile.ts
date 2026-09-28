#!/usr/bin/env tsx

/**
 * Analyze CPU profile file (V8 format)
 */

import { pct } from '@senars/util';
import * as fs from 'fs';

const profileFiles = fs.readdirSync('.').filter((f) => f.endsWith('.cpuprofile'));
if (profileFiles.length === 0) {
  console.error('No .cpuprofile files found');
  process.exit(1);
}

const latestProfile = profileFiles.sort().pop()!;
console.log(`Analyzing: ${latestProfile}`);

const profileData = fs.readFileSync(latestProfile);
const profile = JSON.parse(profileData.toString());

const nodes = profile.nodes || [];
const samples = profile.samples || [];
const timeDeltas = profile.timeDeltas || [];

// Build node lookup
const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

// Count samples per node
const sampleCounts = new Map<number, number>();
for (const sampleNodeId of samples) {
  sampleCounts.set(sampleNodeId, (sampleCounts.get(sampleNodeId) || 0) + 1);
}

// Calculate inclusive time (including children)
function getFunctionName(nodeId: number): string {
  const node = nodeMap.get(nodeId);
  if (!node) return '(unknown)';
  const cf = node.callFrame;
  const name = cf.functionName || '(anonymous)';
  const url = cf.url || '';
  const line = cf.lineNumber || 0;
  return `${name} (${url}:${line})`;
}

// Print top functions by exclusive samples
const sorted = Array.from(sampleCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50);

console.log('\nTop 50 functions by exclusive sample count:');
for (const [nodeId, count] of sorted) {
  const share = pct(count / samples.length);
  console.log(`  ${share}% (${count}) ${getFunctionName(nodeId)}`);
}

// Also calculate inclusive (walk up the tree)
console.log('\n\n--- Inclusive time (walking call tree) ---');
const inclusiveCounts = new Map<number, number>();

// Build parent map
const parentMap = new Map<number, number>();
for (const node of nodes) {
  for (const childId of node.children || []) {
    parentMap.set(childId, node.id);
  }
}

for (const [nodeId, count] of sampleCounts) {
  let current = nodeId;
  while (current && current !== 1) {
    // 1 is root
    inclusiveCounts.set(current, (inclusiveCounts.get(current) || 0) + count);
    current = parentMap.get(current) || 0;
  }
  // Also add to root
  inclusiveCounts.set(1, (inclusiveCounts.get(1) || 0) + count);
}

const sortedInclusive = Array.from(inclusiveCounts.entries())
  .filter(([id]) => id !== 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50);

console.log('\nTop 50 functions by inclusive sample count:');
for (const [nodeId, count] of sortedInclusive) {
  const share = pct(count / samples.length);
  console.log(`  ${share}% (${count}) ${getFunctionName(nodeId)}`);
}

console.log(`\nTotal samples: ${samples.length}`);
console.log(`Total functions: ${nodes.length}`);
