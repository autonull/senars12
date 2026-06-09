#!/bin/bash
# Warns on suspiciously large deletions in the staged diff.
# Does NOT reject commits by default — use --strict for that.
set -e

STAGED=$(git diff --cached --stat)
DELETIONS=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | awk '{sum += $1} END {print sum+0}')
FILES_DELETED=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | wc -l)
LARGEST_FILE_DEL=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | awk '{print $1}' | sort -rn | head -1)

if [ "${DELETIONS:-0}" -gt 3000 ] || [ "${LARGEST_FILE_DEL:-0}" -gt 1000 ]; then
    echo "WARNING: Large deletion detected:"
    echo "    Total lines deleted: ${DELETIONS:-0}"
    echo "    Files affected: $FILES_DELETED"
    echo "    Largest single file: ${LARGEST_FILE_DEL:-0} lines"
    echo ""
    if [ "$1" = "--strict" ]; then
        echo "To override, include 'I-INTENTIONALLY-DELETED-LARGE-FILE' in your commit message."
        if ! git log -1 --format=%B | grep -q "I-INTENTIONALLY-DELETED-LARGE-FILE"; then
            echo "Commit rejected."
            exit 1
        fi
    fi
    echo "Consider documenting this in docs/architecture.md."
fi
