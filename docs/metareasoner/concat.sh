
#!/usr/bin/env bash

for file in "$@"; do
    printf '# %s\n\n' "$(basename "$file")"
    cat "$file"
    printf '\n----\n\n'
done

