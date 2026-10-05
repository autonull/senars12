### Self-Concept Vocabulary

<details>
<summary><b>Narsese Self-Concept Vocabulary</b></summary>

```narsese
<!-- Components -->
(system_component --> knob).
(system_component --> strategy).
(system_component --> tool).
(system_component --> rule).
(system_component --> test).
(system_component --> scenario).
(system_component --> concept).
(system_component --> schema).
(system_component --> capability).

<!-- Causal/functional relations -->
(knob_maxLoops --> affects_modelRunner_maxLoops).
(strategy_focused --> reduces_derivations).
(tool_codemod --> modifies_source_code).
(rule_transitivity --> derives_implication).
(test_fix_test --> requires_codemod).
(scenario_induction --> tests_induction_capability).
(schema --> promotes_to_rule).
(capability --> implemented_by_tool).

<!-- Fix patterns (semantic concepts) -->
(fix_pattern_null_check --> applies_to_null_pointer_error).
(fix_pattern_type_annotation --> applies_to_type_mismatch_error).
(fix_pattern_boundary_check --> applies_to_out_of_bounds_error).
(fix_pattern_assertion --> applies_to_assertion_failure).
(fix_pattern_undefined_check --> applies_to_undefined_variable).
(fix_pattern_empty_check --> applies_to_empty_collection_error).
(fix_pattern_division_by_zero --> applies_to_division_by_zero_error).
(fix_pattern_async_handling --> applies_to_unhandled_promise_rejection).

<!-- Self-model: the system knows it can self-modify -->
(self --> can_modify_own_code).
(self --> can_tune_own_knobs).
(self --> can_add_own_rules).
(self --> can_generate_own_tests).
(self --> can_run_own_scenarios).
```

</details>
