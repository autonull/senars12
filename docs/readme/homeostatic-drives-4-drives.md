### Homeostatic Drives (4 Drives)

| Drive | Goal | Decay | Replenished By |
|-------|------|-------|----------------|
| `curiosity` | `(self --> curious)!` | 0.02/cycle | `generate_scenarios`, `coverage_concepts` on low-coverage |
| `competence` | `(self --> competent)!` | 0.015/cycle | `run_tests` (green), `tune_knob` (reward ↑) |
| `coherence` | `(self --> coherent)!` | 0.01/cycle | `resolve_contradiction`, schema promotion |
| `social` | `(self --> social)!` | 0.05/cycle | Human interaction (CLI/IRC) |
