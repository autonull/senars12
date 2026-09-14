# Graceful Degradation Matrix

This document describes SeNARS behavior when various LLM providers become unavailable.

## Degradation Scenarios

| Scenario | Detection | Behavior | Fallback Chain | User Impact |
|----------|-----------|----------|----------------|-------------|
| **Cloud LM down** (Anthropic/OpenAI/OpenAI-Compatible) | HTTP 5xx, timeout, network error, circuit breaker open | Immediate failover to next provider in chain | `cloud:*` → `local:*` (Ollama) → `builtin:*` (Transformers.js) → `builtin:mock` | Latency increases, quality may degrade. Automatic recovery when cloud provider recovers. |
| **Ollama down** | `/api/tags` probe fails, circuit breaker open | Skip Ollama models, use Transformers.js | `local:*` → `builtin:*` → `builtin:mock` | Local inference only. No GPU-accelerated local models. |
| **Transformers.js model missing** | Model not in cache, download fails, WebGPU unavailable | Fall back to smaller cached model or mock | `builtin:quality` → `builtin:fast` → `builtin:compact` → `builtin:mock` | Quality degrades progressively. Mock mode provides structural responses only. |
| **All providers unavailable** | All circuit breakers open, no cached models | Mock provider only | `builtin:mock` | System remains responsive but provides no semantic reasoning. |

## Provider Chain Resolution

The effective model chain for each task is determined by:

1. **Routing Policy** (`senars.config.json` → `routing.candidates`)
2. **Circuit Breaker State** (open providers excluded)
3. **Objective Constraints** (`offlineOnly`, `maxLatencyMs`)
4. **Offline Ladder** (always appended as failsafe)

### Default Chains by Provider

```typescript
// When provider = 'anthropic' (with credentials)
quality: ['cloud:quality', 'local:quality', 'builtin:quality', 'builtin:mock']
fast:    ['cloud:fast',    'local:fast',    'builtin:compact', 'builtin:mock']
structured: ['cloud:structured', 'local:quality', 'builtin:compact', 'builtin:mock']

// When provider = 'ollama'
quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock']
fast:    ['local:fast',    'builtin:compact', 'builtin:mock']
structured: ['local:quality', 'builtin:compact', 'builtin:mock']

// When provider = 'transformers' (no cloud key)
quality: ['builtin:quality']
fast:    ['builtin:fast']
structured: ['builtin:structured']

// When provider = 'mock'
quality: ['builtin:mock']
fast:    ['builtin:mock']
structured: ['builtin:mock']
```

## Circuit Breaker Behavior

| Provider | Failure Threshold | Reset Timeout | Success Threshold |
|----------|-------------------|---------------|-------------------|
| Anthropic | 3 | 60s | 2 |
| OpenAI | 3 | 60s | 2 |
| OpenAI-Compatible | 5 | 30s | 2 |
| Ollama | 10 | 15s | 3 |
| Transformers | 20 | 5s | 5 |
| Mock | 100 | 1s | 10 |

- **Closed**: Normal operation, calls allowed
- **Open**: Calls blocked, failover immediate
- **Half-Open**: Single test call allowed, success closes, failure reopens

## Health Probes

Background probes run every 60s (configurable) for:
- **Cloud providers**: `GET /models` with auth headers
- **Ollama**: `GET /api/tags`

Probe results update circuit breaker state:
- Success on open breaker → half-open
- Failure on closed breaker → increment failure count

## `senars doctor --degradation`

Shows current degradation posture:

```
=== Degradation Posture ===
Active provider: anthropic
Effective chain (quality): cloud:quality → local:quality → builtin:quality → builtin:mock
Circuit breakers:
  anthropic: closed (failures=0)
  ollama: closed (failures=0)
  transformers: closed (failures=0)
Offline tier: builtin:quality (cached)
Credentials: anthropic ✓, openai ·, ollama ·
```

## Configuration

```json
{
  "lm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "circuitBreaker": {
      "anthropic": { "failureThreshold": 3, "resetTimeoutMs": 60000, "successThreshold": 2 },
      "ollama": { "failureThreshold": 10, "resetTimeoutMs": 15000, "successThreshold": 3 }
    }
  },
  "routing": {
    "candidates": ["cloud:quality", "local:quality", "builtin:quality"],
    "objectives": {
      "fast": { "offlineOnly": true },
      "quality": { "maxLatencyMs": 10000 }
    },
    "offlineLadder": ["small/smollm2", "mid/qwen2.5-1.5b-instruct", "big/qwen2.5-7b-instruct"]
  }
}
```

## Testing Degradation

```bash
# Simulate cloud failure
LM_PROFILE=production pnpm chat

# Force offline mode
LM_OFFLINE_ONLY=1 pnpm chat

# Use mock provider only
LM_PROVIDER=mock pnpm chat

# Check current posture
pnpm doctor --degradation
```

## Recovery

- **Automatic**: Health probes detect recovery, circuit breakers transition half-open → closed
- **Manual**: `pnpm doctor` shows effective config; restart clears all circuit breaker state
- **Config-driven**: Update `senars.config.json` routing to pin preferred providers