#!/bin/bash
# Detects deleted files whose exports are not re-exported anywhere.
# Run weekly via CI.
set -e

mkdir -p .cache/audits
REPORT=".cache/audits/deleted-files.txt"
> "$REPORT"

if ! git rev-parse HEAD~50 >/dev/null 2>&1; then
    echo "Not enough history for 50-commit window; skipping."
    exit 0
fi

git log --diff-filter=D --name-only --pretty=format: HEAD~50..HEAD 2>/dev/null | \
    grep -E '\.ts$' | sort -u | while read -r file; do
    if [ -z "$file" ]; then continue; fi
    lines=$(git show "HEAD~50:$file" 2>/dev/null | wc -l)
    if [ "${lines:-0}" -gt 100 ]; then
        exports=$(git show "HEAD~50:$file" 2>/dev/null | \
            grep -E '^export ' | sed -E 's/export +(const|class|function|interface|type|enum) +([a-zA-Z_][a-zA-Z_0-9]*).*/\2/' | head -10)
        for sym in $exports; do
            if [ -z "$sym" ]; then continue; fi
            if ! grep -rq "export.*\\b$sym\\b" src/ 2>/dev/null; then
                echo "$file: $sym (deleted, not re-exported)" >> "$REPORT"
            fi
        done
    fi
done

echo "Audit complete. Report: $REPORT"
if [ -s "$REPORT" ]; then
    cat "$REPORT"
fi
