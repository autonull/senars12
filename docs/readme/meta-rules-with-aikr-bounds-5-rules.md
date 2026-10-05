### Meta-Rules with AIKR Bounds (5 Rules)

| Rule | Trigger | Action | AIKR Bounds |
|------|---------|--------|-------------|
| **Strategy Select** | `drive:competence --> low` | `switch_strategy($s)!` | depth=2, budget=5/step, priority=0.1, threshold=0.6 |
| **Knob Tune** | `rlfp:reward --> below_threshold` | `^tune_knob($k, $v)!` | depth=2, budget=5/step |
| **Test Repair** | `test_failed & error_pattern & fix_pattern` | `apply_fix($fix)!` | depth=2, budget=5/step |
| **Schema Promote** | `confidence > 0.9 & frequency > 10` | `^promote_rule($s)!` | depth=2, budget=5/step |
| **Capability Scaffold** | `capability & template` | `^scaffold($tmpl, $c)!` | depth=2, budget=5/step |
