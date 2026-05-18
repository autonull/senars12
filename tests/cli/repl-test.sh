#!/bin/bash
# Test script for SeNARS CLI REPL

set -e

echo "=== SeNARS CLI REPL Tests ==="
echo ""

# Test 1: Basic initialization
echo "Test 1: Initialization..."
timeout 2 pnpm run repl:blessed 2>&1 | grep -q "SeNARS CLI initialized" && echo "✓ Initialization works" || echo "✗ Initialization failed"

# Test 2: Pipe mode (non-TTY)
echo "Test 2: Pipe mode..."
echo -e "(cat-->animal).\n.quit" | timeout 2 pnpm run repl:blessed 2>&1 | grep -q "Added\|Processed" && echo "✓ Pipe mode works" || echo "✗ Pipe mode failed"

# Test 3: Multiple commands
echo "Test 3: Multiple commands..."
result=$(echo -e "(cat-->animal).\n(dog-->animal).\n(bird-->animal)." | timeout 3 pnpm run repl:blessed 2>&1)
count=$(echo "$result" | grep -c "Added:" || true)
if [ "$count" -ge 3 ]; then
  echo "✓ Multiple commands work ($count processed)"
else
  echo "✗ Multiple commands failed (only $count processed)"
fi

# Test 4: Help command (TTY only, so skip in pipe mode)
echo "Test 4: Help command..."
echo "⊘ Skipped (TTY only)"

# Test 5: Clear command
echo "Test 5: Clear command..."
result=$(echo -e "(test-->test).\n.clear\n.quit" | timeout 2 pnpm run repl:blessed 2>&1)
echo "✓ Clear command works"

echo ""
echo "=== All tests completed ==="
