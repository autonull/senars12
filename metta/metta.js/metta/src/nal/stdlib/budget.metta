
; budget.metta - Budget (Priority/Durability/Quality) Heuristics
; Implements NARS AIKR resource allocation

; Budget triple: (Priority Durability Quality)
(= (Budget $p $d $q) ($p $d $q))

; OR-priority: Take maximum priority
; Used when task can be satisfied by either premise
(= (budget-or ($p1 $d1 $q1) ($p2 $d2 $q2))
   ((&or-priority $p1 $p2) (&max $d1 $d2) (&max $q1 $q2)))

; AND-priority: Average priority weighted by quality
; Used when both premises required
(= (budget-and ($p1 $d1 $q1) ($p2 $d2 $q2))
   ((&and-priority $p1 $p2) (&* $d1 $d2) (&* $q1 $q2)))

; Merge budgets (for revision)
; Average priority, max durability, average quality
(= (budget-merge ($p1 $d1 $q1) ($p2 $d2 $q2))
   ((&/ (&+ $p1 $p2) 2) (&max $d1 $d2) (&/ (&+ $q1 $q2) 2)))

; Budget decay (forgetting)
; Apply decay rate to all components
(= (budget-decay ($p $d $q) $rate)
   ((&* $p $rate) (&* $d $rate) (&* $q $rate)))

; Budget promotion (strengthening)
; Increase priority based on evidence
(= (budget-promote ($p $d $q) $boost)
   ((&min 1 (&+ $p $boost)) $d $q))

; Budget threshold check
; Returns true if any component above threshold
(= (budget-above? ($p $d $q) $threshold)
   (&or (&or (&> $p $threshold) (&> $d $threshold)) (&> $q $threshold)))

; Budget quality from truth value
; Quality = expectation = f * c
(= (budget-from-truth ($f $c))
   (&* $f $c))

; Extract components
(= (budget-priority ($p $d $q)) $p)
(= (budget-durability ($p $d $q)) $d)
(= (budget-quality ($p $d $q)) $q)

; Budget summary (single value for comparison)
; summary = p * 0.5 + d * 0.3 + q * 0.2
(= (budget-summary ($p $d $q))
   (&+ (&+ (&* $p 0.5) (&* $d 0.3)) (&* $q 0.2)))

