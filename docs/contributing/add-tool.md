# Adding a Tool

Two integration paths, depending on who consumes the tool.

## Path 1 — AI-SDK tools (`nar/src/tools/adapters/*.ts`)

Tools exposed to LM tool-calling use the Vercel AI SDK `tool()` helper.
**TODO20 Phase 7 requires strict input schemas** — always `z.strictObject`,
never plain `z.object` (unknown keys must reject, not pass through).
Reference implementation: `nar/src/tools/adapters/http-fetch.ts`.

```ts
// nar/src/tools/adapters/ping.ts
import { tool } from 'ai';
import { z } from 'zod';

export function createPingTools() {
  return {
    ping: tool({
      description: 'Ping a host, returning latency in ms.',
      // STRICT: rejects extra properties (TODO20 Phase 7 requirement)
      inputSchema: z.strictObject({
        host: z.string().min(1).describe('Hostname to ping'),
        timeout: z.number().min(100).max(10_000).optional().default(2000),
      }),
      execute: async ({ host, timeout }) => {
        const start = Date.now();
        try {
          await fetch(`https://${host}`, { signal: AbortSignal.timeout(timeout) });
          return { ok: true, latencyMs: Date.now() - start };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
    }),
  };
}
```

Export the factory from `nar/src/tools/adapters/index.ts` following the
existing `create*Tools` pattern. For NAR-integrated tools, see
`adapters/aisdk-adapter.ts` (`createNARSTools`, which receives `NARSToolDeps`).

## Path 2 — internal `Tool` interface (`nar/src/tools/types.ts`)

Internal execution goes through `ToolManager` (`nar/src/tools/manager.ts`),
which wraps a `Registry` (`nar/src/tools/registry.ts`):

```ts
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Schema;   // JSON-Schema-shaped: { type: 'object', properties, required? }
  capabilities?: ToolCapabilities;  // pure?, readOnly?, requiresPermissions?, timeout?...
  tags?: string[];
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
}
```

`ToolResult` is `{ success, content, error?, partial?, metadata? }`; use the
`errorResult(err)` helper from `types.ts` for failures. The `Registry.execute`
validates args against `tool.parameters` before invoking, so declare the
schema precisely.

```ts
// nar/src/tools/WordCountTool.ts
import type { Tool, ToolResult } from './types.js';

export const wordCountTool: Tool = {
  name: 'word_count',
  description: 'Count words in a text string.',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string', minLength: 1 } },
    required: ['text'],
  },
  capabilities: { pure: true, idempotent: true, readOnly: true },
  tags: ['text'],
  async execute(args): Promise<ToolResult> {
    const text = String(args['text'] ?? '');
    return { success: true, content: text.split(/\s+/).filter(Boolean).length };
  },
};
```

Register it on the manager:

```ts
toolManager.register(wordCountTool, {
  name: 'word_count',
  description: 'Count words in a text string.',
  capabilities: wordCountTool.capabilities,
  tags: ['text'],
  version: '1.0.0',
});
await toolManager.initializeTool('word_count'); // permission-checked
```

### Permission & budget handling (`manager.ts`)

- **Permissions:** tools declaring `capabilities.requiresPermissions` can only
  initialize if every permission is in the manager's `allowedPermissions`;
  in `sandboxMode`, execution additionally requires them in
  `context.permissions`.
- **Budgets:** the `ToolContext.budget` (`ToolBudget`) tracks `executions`
  and `totalDuration` across a call chain; exceeding `maxExecutions` or
  `maxTotalDuration` fails the call.
- **Lifecycle:** `register` → `initializeTool` (state `running`) → execute →
  `stopTool`/`disposeTool`. Statistics and `tool:*` events are emitted
  automatically on the event bus; a per-call abort is honored via
  `context.signal`.

## Which path?

- Called by an LM during generation → Path 1 (AI-SDK, strict zod schema).
- Called by NAL goals (`executeToolGoal`), chains, or internal code →
  Path 2 (`Tool` + `ToolManager`).

## Checklist

- [ ] Path 1: `z.strictObject` input schema (no plain `z.object`)
- [ ] Path 2: `parameters: Schema` matches what `Registry.validateArgs` checks
- [ ] `capabilities.requiresPermissions` declared for side-effecting tools
- [ ] Errors returned as `ToolResult.success: false`, not thrown, when the
      failure is domain-level (Registry catches throws, Manager wraps them)
- [ ] Factories exported from `adapters/index.ts` (Path 1)

## Tests to write

Follow `tests/nar/unit/tools.test.ts` conventions (vitest, direct
construction, no mocks):

- Schema enforcement: invalid/extra args are rejected before `execute` runs.
- Path 1: strict schema rejects unknown keys; defaults applied.
- Lifecycle/permissions: un-granted `requiresPermissions` blocks
  `initializeTool`; sandbox execution fails without `context.permissions`.