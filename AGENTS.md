# Code Guidelines

- Elegant
- Consolidated
- Consistent
- Organized
- Deeply deduplicated: Don't repeat yourself (*DRY*)
- Abstract
- Modularized
- Parameterized

- Terse syntax
    - Ternary, switch, nullish coalescing (`??`), optional chaining (`?.`), template literals
    - Destructuring for cleaner object/array access
    - Consider **latest** language version: syntax, tools, configuration, etc...

- Few comments: rely on self-documenting code. Do not remove JSDocs containing essential Type details

- Purpose: professional, not explanatory/educational

- Unit testing: avoid Mocks; test objects directly. Write focused, deterministic tests. Test behavior, not
  implementation.

- Error handling: Use specific error types, log with context, avoid empty catch blocks, prefer early returns, handle
  errors at appropriate abstraction level

- Performance: Avoid object creation in hot paths, use Set for membership, cache expensive operations, minimize I/O, be
  mindful of deep copying

- Naming: Use descriptive names, consistent patterns for similar concepts, avoid abbreviations, follow project
  conventions

- Imports: Group and sort (stdlib, third-party, local), use consistent paths, avoid wildcards, prefer named imports

- Code structure: Keep functions focused (single responsibility), limit function length, organize methods logically,
  prefer composition over inheritance, maintain consistent class structure

- Use `pnpm`, not `npm`

## Versioning & Deprecation Policy (TODO20 A3/A4)

**Semver (per `@senars/*` package):**
- Breaking change (removed/renamed public export, changed signature): **major**
- New public export (declared in `exports` map, consumed per `pnpm exports:audit`): **minor**
- Internal refactor (no export-surface delta): **patch**

**Export surface rules:**
- `pnpm exports:audit` is the gate: every `exports` subpath needs an in-repo consumer
  or a `PUBLIC_API` declaration in `scripts/exports-audit.ts`. No speculative exports.
- `pnpm exports:check` additionally guards dangling export targets.
- Internal code imports via relative paths, not package specifiers — the exports map
  is the *declared public API*, not an internal shortcut.

**Deprecation lifecycle:**
1. Mark with a JSDoc `@deprecated since X.Y — <replacement>` tag (lints in editors, greppable).
2. Keep the old path working for **2 minors**.
3. Remove in the next major; the removal is the breaking change.
- Case studies: `SeNARSFactory` deleted outright (TODO19 — pre-policy); `ollama` provider
  retired via alias-to-`openai-compatible` at the settings boundary (§5f of TODO20);
  `memory.derivationDepth` alias is the current live deprecation.
