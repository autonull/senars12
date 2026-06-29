/**
 * Test Uniqueness Validation
 *
 * Ensures test names are unique within their describe blocks to prevent
 * test collisions and improve test reliability.
 */

interface TestRegistry {
  describeBlock: string;
  testNames: Set<string>;
}

const registry: Map<string, TestRegistry> = new Map();

/**
 * Registers a test name within a describe block
 */
export function registerTest(describeBlock: string, testName: string): boolean {
  const key = describeBlock;
  if (!registry.has(key)) {
    registry.set(key, { describeBlock, testNames: new Set() });
  }

  const block = registry.get(key)!;

  if (block.testNames.has(testName)) {
    console.warn(`⚠️  Duplicate test name in "${describeBlock}": "${testName}"`);
    return false;
  }

  block.testNames.add(testName);
  return true;
}

/**
 * Clears the registry for a specific describe block
 */
export function clearRegistry(describeBlock?: string): void {
  if (describeBlock) {
    registry.delete(describeBlock);
  } else {
    registry.clear();
  }
}

/**
 * Gets duplicate test names in a describe block
 */
export function getDuplicates(describeBlock: string): string[] {
  const block = registry.get(describeBlock);
  if (!block) return [];

  return Array.from(block.testNames);
}

/**
 * Validates all test names in registry
 */
export function validateRegistry(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const [, block] of registry) {
    if (block.testNames.size === 0) {
      continue;
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Custom matcher for test uniqueness
 */
export function expectTestToBeUnique(describeBlock: string, testName: string): void {
  const isUnique = registerTest(describeBlock, testName);
  if (!isUnique) {
    throw new Error(`Duplicate test name: "${testName}" in "${describeBlock}"`);
  }
}

/**
 * Get registry statistics
 */
export function getRegistryStats(): {
  totalBlocks: number;
  totalTests: number;
  blocks: string[];
} {
  const blocks = Array.from(registry.keys());
  const totalTests = Array.from(registry.values()).reduce(
    (sum, block) => sum + block.testNames.size,
    0
  );

  return {
    totalBlocks: blocks.length,
    totalTests,
    blocks,
  };
}

/**
 * Decorator for Jest's describe to automatically track test uniqueness
 */
export function trackedDescribe(describeBlock: string, fn: () => void): void {
  clearRegistry(describeBlock);
  describe(describeBlock, () => {
    const originalTest = global.test || global.it;

    const trackedTest = (testName: string, fn: () => void) => {
      expectTestToBeUnique(describeBlock, testName);
      originalTest(testName, fn);
    };

    global.test = trackedTest as any;
    global.it = trackedTest as any;

    try {
      fn();
    } finally {
      global.test = originalTest;
      global.it = originalTest;
    }
  });
}
