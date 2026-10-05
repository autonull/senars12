### Live Ingress

With System One enabled, raw natural language reaches the manifold **before** parsing:

```
nar.input("the robin is a bird")
  └─▶ KernelPerceptionGate.admit (raw utterance, not the parsed term)
        ├─ Tier 0 parse (Narsese heuristic — unchanged)
        ├─ EmbeddingCache (O(1), alias-free, single caching layer)
        └─ one joint judgeBatch: task_type · illocution · injection ·
                                 ambiguity · tense · source_quality
              ├─ ambiguity abstain ─▶ inject a clarification Question + curiosity drive
              ├─ tense ─▶ occurrenceTime anchor on the admitted task
              └─ source_quality ─▶ seedTruth ceiling (LLM_PRIOR default)
```

The gate's calibrated truth and task type are **adopted** — ingress judgments are never computed and thrown away.
