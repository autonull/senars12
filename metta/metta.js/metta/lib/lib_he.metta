; lib_he.metta - H-E (Hyperon Experimental) compatibility library
; Provides functions used by he_*.metta tests

; ===== Identity =====
(= (id $x) $x)

; ===== Equality helpers =====
; if-equal: compare two values, return then or else branch
(= (if-equal $a $b $then $else)
   (if (== $a $b) $then $else))

; ===== Alpha equivalence =====
; (=alpha $a $b) is in core.metta

; ===== Assert functions =====
; assertEqual: assert two expressions reduce to the same value
(= (assertEqual $a $b)
   (let* (($ra (eval $a))
          ($rb (eval $b)))
         (if (== $ra $rb) True (Error (assertEqual $a $b) Mismatch))))

; assertAlphaEqual: assert two expressions are alpha-equivalent
(= (assertAlphaEqual $a $b)
   (if (=alpha $a $b) True (Error (assertAlphaEqual $a $b) NotAlphaEqual)))

; ===== Error handling =====
; catch: evaluate expression, return Error on failure or the result
(= (catch $expr)
   (let $r (eval $expr)
        (if (== (get-metatype $r) Expression)
            (if (== (get-type $r) Error)
                (Error $r BadType)
                $r)
            $r)))

; if-error: check if result is an Error, return thenBranch or elseBranch
(= (if-error $result $thenBranch $elseBranch)
   (case $result
         (((Error $_ $_) $thenBranch)
          ($_ $elseBranch))))

; Simplified if-error using pattern matching
(= (if-error (Error $a $b) $then $_) $then)
(= (if-error $_ $_ $else) $else)

; return-on-error: if $val is an Error return it, else evaluate $next
(= (return-on-error (Error $a $b) $_) (Error $a $b))
(= (return-on-error $val $next) $next)

; ===== Quoting =====
; quote: prevent reduction
(= (quote $x) (noeval $x))

; unquote: force reduction of quoted expression
(= (unquote (noeval $x)) (eval $x))
(= (unquote $x) (eval $x))

; noreduce-eq: structural equality without reduction
(= (noreduce-eq $a $b) (=alpha $a $b))

; ===== Evaluation in context =====
; evalc: evaluate expression in a given space context
(= (evalc $expr $_space) (eval $expr))

; ===== Iteration =====
; for-each-in-atom: apply function to each element, return list of results
(= (for-each-in-atom () $f) ())
(= (for-each-in-atom (: $h $t) $f)
   (let $_ ($f $h)
        (: true (for-each-in-atom $t $f))))
(= (for-each-in-atom ($h) $f)
   (let $_ ($f $h) (: true ())))
(= (for-each-in-atom ($h $rest) $f)
   (let $_ ($f $h)
        (: true (for-each-in-atom $rest $f))))

; ===== Type predicates =====
; is-function: check if type is a function type (->)
(= (is-function $t) (^ &is-function $t))

; match-types: check if two types are compatible
(= (match-types $t1 $t2 $then $else) (^ &match-types $t1 $t2 $then $else))

; match-type-or: return value if it matches one of two types
(= (match-type-or $val $t1 $t2)
   (if (or (== (get-metatype $val) $t1)
           (== (get-metatype $val) $t2))
       $val
       (empty)))

; first-from-pair and second-from-pair are in core.metta
