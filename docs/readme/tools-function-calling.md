### Tools & Function Calling

```typescript
import { ToolManager, discoverTools, ExplainTool, SleepTool, TimerTool } from '@senars/nar/tools';

const tools = nar.tools;
await tools.execute('explain', { term: '(cat --> animal)' });
await tools.execute('sleep', { ms: 1000 });
await tools.execute('timer', { action: 'start', name: 'reasoning' });

// Custom tools via decorator
@Tool({ name: 'my_tool', description: '...', schema: {...} })
async function myTool(args: { input: string }) { ... }
```

**Built-in tool surface (all backed by real implementations):** fs (`fs_read`, `fs_write`,
`fs_append`, workspace-sandboxed), `shell` (30s timeout, async), web (`search` across a shared
provider registry — Tavily → Brave → DuckDuckGo, whichever is configured — plus `tavily_search`,
`brave_search`, and the read-only `web_fetch`), memory (`remember`, `query`, `episodes` —
episodic memory; fail honestly when no backend), `metta` (delegates to the MeTTa engine), plus
approval/timer/sleep utilities.

**Every tool outcome is built by `toolOk` / `toolError`.** `ToolResult` has one constructor pair in
`@senars/util`, and a tool returns through it rather than by spelling `{ success, content }`. The
second argument is where the parts that are optional go — `partial` output, `metadata` — so
`content: null` and a populated `metadata` cannot drift apart:

```typescript
import { toolError, toolOk } from '@senars/util';

return toolOk(explanation, { metadata: { term: concept.term.toString() } });
return toolError(e);                       // anything thrown, stringified at the boundary
return toolError('not configured', { partial: true });
```

This matters more than tidiness. `toolError` takes `unknown` and coerces, so a rejected string or a
thrown non-`Error` produces a tool failure instead of a second throw inside the catch block — which
is what `(e as Error).message` did at every one of the sites it appeared in. A tool that reports a
failure must never fail while reporting it.
