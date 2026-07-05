; MeTTa Standard Library - Match Module
; Non-deterministic pattern matching

; ===== Pattern Matching =====

; match: pattern matching against space
; (match $space $pattern $template)
; Returns: all instances where $pattern matches atoms in $space,
;          with $template instantiated by the bindings

; Use grounded &match for performance and to avoid stack overflow
; (recursion on get-atoms list is too deep without TCO)
(= (match $space $pattern $template) (^ &match $space $pattern $template))

; ===== Unification Wrappers =====

; unify: expose kernel unification
(= (unify $p $t) (^ &unify $p $t))

; subst: expose kernel substitution
(= (subst $t $b) (^ &subst $t $b))

; ok?: check if unification succeeded
(= (ok? $b) (not (== $b False)))

; ===== Match Utilities =====

; match-first: return only first match
(= (match-first $space $pattern $template)
   (car (match $space $pattern $template)))

; match-all: return all matches (alias)
(= (match-all $space $pattern $template)
   (match $space $pattern $template))

; match-count: count number of matches
(= (match-count $space $pattern)
   (length (match $space $pattern $pattern)))

; exists?: check if pattern has any matches
(= (exists? $space $pattern)
   (not (empty? (match $space $pattern $pattern))))

; ===== Advanced Matching =====

; match-where: match with additional constraint
; (match-where $space $pattern $constraint $template)
(= (match-where $space $pattern $constraint $template)
   (filter (λ $x $constraint)
           (match $space $pattern $template)))

; match-bind: match and bind to variable
; (match-bind $var $space $pattern $body)
(= (match-bind $var $space $pattern $body)
   (map (λ $var $body) (match $space $pattern $pattern)))
