; MeTTa Standard Library - Core Module
; Basic control flow, binding, and lambda functions

; ===== Conditional Branching =====

; if: conditional evaluation — specific rules for concrete values
(= (if True $then $else) $then)
(= (if False $then $else) $else)
; Non-concrete conditions: ZipperStage reduces sub-expressions first,
; then the specific rules above match. No general &if rule needed.

; ===== Variable Binding =====

; let: bind a value to a variable in a body expression
; (let $x $value $body) → evaluate $body with $x bound to $value
; Implementation: Convert to lambda application
(= (let $x $v $b) (^ &let $x $v $b))

; Sequential let bindings (let*)
; (let* (($x $v1) ($y $v2)) $body) → nested lets
(= (let* $bindings $body) (^ &let* $bindings $body))

; ===== Lambda (Anonymous Functions) =====

; Lambda application: ((λ $x $body) $value)
; Use &let grounded op to perform substitution
; IMPORTANT: Pattern uses $param/$val to avoid variable name collision with lambda body
(= ((λ $param $body) $val) (^ &let $param $val $body))
(= ((lambda $param $body) $val) (^ &let $param $val $body))

; PeTTa style lambda
(= ((|-> $param $body) $val) (^ &let $param $val $body))
; 2-arg call: ((|-> ($x $y) body) a b) → ((|-> ($x $y) body) (a b))
(= ((|-> $param $body) $val1 $val2) ((|-> $param $body) ($val1 $val2)))
; 3-arg call
(= ((|-> $param $body) $val1 $val2 $val3) (((|-> $param $body) ($val1 $val2)) $val3))
; curried: (((|-> $param $body) $val1) $val2) → ((|-> $param $body) ($val1 $val2))
(= (((|-> $param $body) $val1) $val2) ((|-> $param $body) ($val1 $val2)))

; Same for lambda/λ multi-arg
(= ((lambda $param $body) $val1 $val2) ((lambda $param $body) ($val1 $val2)))
(= (((lambda $param $body) $val1) $val2) ((lambda $param $body) ($val1 $val2)))

; Multiple argument lambda (curried)
; (λ ($x $y) $body) → (λ $x (λ $y $body))
; Rules moved to ReductionEngine.js to avoid variable unification issues

; Ensure &subst triggers reduction on its result
(= (^ &subst $p $v $b) (let $p $v $b))

; ===== Sequencing =====

; Sequential evaluation - evaluate expressions in order, return last
; (seq $a $b) → evaluate $a, then return $b
(= (seq $a $b) (let $_ $a $b))

; Multiple sequence
(= (seq* $a) $a)
(= (seq* $a $b $rest) (seq $a (seq* $b $rest)))

; ===== Basic Logic =====

; Boolean constants (these are atoms, defined here for reference)
; True - boolean true
; False - boolean false

; not: logical negation
(= (not True) False)
(= (not False) True)

; and: logical conjunction
(= (and True False) False)
(= (and False True) False)

; or: logical disjunction
(= (or True $_) True)
(= (or False $x) $x)

; ===== Utility Functions =====

; identity: return the value unchanged
(= (id $x) $x)

; const: return first argument, ignore second
(= (const $x $_) $x)

; compose: function composition
; (compose $f $g $x) → ($f ($g $x))
(= (compose $f $g $x) ($f ($g $x)))

; ===== Grounded Operations Mapping =====
; Map standard operators to grounded functions
(= (+ $a $b) (^ &+ $a $b))
(= (+ $a $b $c) (^ &+ $a $b $c))
(= (- $a $b) (^ &- $a $b))
(= (- $a) (^ &- $a))
(= (* $a $b) (^ &* $a $b))
(= (* $a $b $c) (^ &* $a $b $c))
(= (/ $a $b) (^ &/ $a $b))
(= (< $a $b) (^ &< $a $b))
(= (> $a $b) (^ &> $a $b))
(= (== $a $b) (^ &== $a $b))
(= (% $a $b) (^ &% $a $b))

; Explicit grounded aliases (with & prefix)
(= (&+ $a $b) (^ &+ $a $b))
(= (&- $a $b) (^ &- $a $b))
(= (&* $a $b) (^ &* $a $b))
(= (&/ $a $b) (^ &/ $a $b))
(= (and $a $b) (^ &and $a $b))
(= (or $a $b) (^ &or $a $b))
(= (not $a) (^ &not $a))
(= (get-atoms $s) (^ &get-atoms $s))
(= (add-atom $s $x) (^ &add-atom $s $x))
(= (rm-atom $s $x) (^ &rm-atom $s $x))
(= (remove-atom $s $x) (^ &rm-atom $s $x))

; Expression Operations
(= (cons-atom $h $t) (^ &cons-atom $h $t))
(= (decons-atom $e) (^ &decons-atom $e))
(= (car-atom $e) (^ &car-atom $e))
(= (cdr-atom $e) (^ &cdr-atom $e))
(= (size-atom $e) (^ &size-atom $e))
(= (index-atom $e $i) (^ &index-atom $e $i))

; Type Operations
(= (get-metatype $a) (^ &get-metatype $a))
(= (get-type $a) (^ &get-type $a))
(= (is-function $t) (^ &is-function $t))

; ===== Control Flow =====

; cut: prune alternative branches in non-deterministic reduction
(= (cut) (^ &cut))

; once: evaluate expression and return only first result, pruning alternatives
(= (once $x) (^ &once $x))

; empty: return the empty list
(= (empty) ())

; is-var: check if an atom is a variable
(= (is-var $x) (^ &is-var $x))

; case: pattern matching with multiple branches
; (case expr ((pat1 res1) (pat2 res2) ...))
(= (case $expr $branches) (^ &case $expr $branches))

; foldall: fold over all reduction results
(= (foldall $op $expr $init) (^ &foldall $op $expr $init))

; repr: string representation with partial application detection
(= (repr $x) (^ &repr $x))

; =alpha: alpha-equivalence check
(= (=alpha $a $b) (^ &=alpha $a $b))

; ===== Pair Operations =====
(= (first-from-pair ($a $_)) $a)
(= (second-from-pair ($_ $b)) $b)

; ===== Sequencing (progn/prog1) =====
; progn: evaluate all args, return last
(= (progn $a) $a)
(= (progn $a $b) (let $_ $a $b))
(= (progn $a $b $c) (let $_ $a (progn $b $c)))
(= (progn $a $b $c $d) (let $_ $a (progn $b $c $d)))

; prog1: evaluate all args, return first
(= (prog1 $a) $a)
(= (prog1 $a $b) (let $x $a (let $_ $b $x)))
(= (prog1 $a $b $c) (let $x $a (let $_ (progn $b $c) $x)))

; ===== is-member: check list membership =====
(= (is-member $x ()) False)
(= (is-member $x ($x $rest)) True)
(= (is-member $x ($h $rest)) (is-member $x $rest))
(= (is-member $x (: $x $_)) True)
(= (is-member $x (: $h $t)) (is-member $x $t))

; ===== msort: sort a list =====
(= (msort $l) (^ &msort $l))

; ===== length: count elements in a list =====
(= (length $l) (^ &length $l))

; ===== hyperpose: non-deterministic choice from a list =====
(= (hyperpose $l) (^ &hyperpose $l))

; ===== maplist: apply function to list, return list =====
(= (maplist $f ()) ())
(= (maplist $f (: $h $t)) (: ($f $h) (maplist $f $t)))
(= (maplist $f ($h)) (: ($f $h) ()))
(= (maplist $f ($h $rest)) (: ($f $h) (maplist $f $rest)))
