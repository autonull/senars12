## Web UI & Visualization

### Dashboard

Real-time cognitive visualization:

- **Graph Viewport** — 3D force-directed concept graph (via SpaceGraphJS)
- **Chat History** — Conversation transcript
- **Cognitive Metrics** — Attention, derivation rate, memory pressure
- **Config HUD** — Live parameter tuning
- **Timeline Scrubber** — Replay reasoning history
- **Lens Designer** — Custom graph projections
- **Node Detail Drawer** — Inspect concept/task details

```bash
# Start with web UI
ENABLE_WEB_UI=true pnpm bot
# Opens http://localhost:3000
```

### Lens — Declarative UI Projections

**Lenses** map cognitive state to visual channels (color, size, opacity, stroke) via a composable AST:

```typescript
import { LensSpec, ModulationSchema, builtinLensSpecs, isBuiltinLens } from '@senars/core';
```

**Built-in Lenses:**

| Lens | Description | Visual Mapping |
|------|-------------|----------------|
| `belief` | What the system knows | Color=truth frequency, Opacity=confidence |
| `goal` | What the system wants | Size=priority, Color=cyan |
| `contradiction` | Where beliefs conflict | Color=orange, Dashed stroke |

**Modulation AST** (composable):

```typescript
{ op: 'union', children: [
  { op: 'channel', channel: 'color', child: { op: 'field', field: 'truth', map: 'truth-to-color' }},
  { op: 'when', predicate: 'isContradiction', child: { op: 'channel', channel: 'color', child: { op: 'const', value: '#ffaa00' }}}
]}
```

Operations: `const`, `field`, `channel`, `when`, `union` — enabling arbitrary visual mappings.

### Protocol — Client/Server Cognitive Sync

Real-time WebSocket protocol for UI synchronization:

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `chat.user` / `chat.agent.complete` | ↔ | Chat streaming |
| `cognitive.delta` | Server→Client | Graph ops (add/update/remove nodes/edges) |
| `config.schema` / `config.set` | ↔ | Live parameter tuning |
| `lens.list` / `lens.define` | ↔ | Lens management |
| `sync.request` / `state.snapshot` | ↔ | Full state sync |
| `viewport.set` / `focus.set` | Client→Server | Camera/selection |
| `history.request` | ↔ | Node derivation history |

**Graph Node Types:**

| Type | Source | Fields |
|------|--------|--------|
| `NarConceptNode` | NAR | term, truth, priority, revision history |
| `MettaAtomNode` | MeTTa | atom, type, space |
| `MettaSkillNode` | MeTTa | skill name, code, I/O schema |
