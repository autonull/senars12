; MeTTa Standard Library - List Module
; List manipulation and higher-order functions

; ===== List Construction =====

; Cons-list notation:
; () - empty list
; (: $head $tail) - cons cell (head :: tail)

; List constructor helpers
(= (cons $h $t) (: $h $t))
(= (nil) ())

; ===== List Accessors =====

; car/cdr - traditional Lisp accessors
(= (car (: $h $_)) $h)
(= (cdr (: $_ $t)) $t)

; head/tail - modern names
(= (head (: $h $_)) $h)
(= (tail (: $_ $t)) $t)

; ===== List Predicates =====

; Check if list is empty
(= (empty? ()) True)
(= (empty? (: $h $t)) False)

; Check if atom is a list
(= (list? ()) True)
(= (list? (: $_ $t)) (list? $t))
(= (list? $_) False)

; ===== Map =====

; map: apply function to each element
; (map $f ()) → ()
; (map $f (: $h $t)) → (: ($f $h) (map $f $t))
; Using grounded &map-fast for Phase 2 success criterion
(= (map $f $list) (^ &map-fast $f $list))

; apply: helper for higher-order function applications
; Ensures both grounded lambdas and symbolic rules work
(= (apply (λ $p $b) $v) (^ &subst $p $v $b))
(= (apply (lambda $p $b) $v) (^ &subst $p $v $b))
(= (apply $f $v) ($f $v))

; ===== Fold (Reduce) =====

; fold-left: accumulate from left
; (fold $f $z ()) → $z
; (fold $f $z (: $h $t)) → (fold $f ($f $z $h) $t)
(= (fold $f $z ()) $z)
(= (fold $f $z (: $h $t)) (fold $f ($f $z $h) $t))

; fold-right: accumulate from right
(= (fold-right $f $z ()) $z)
(= (fold-right $f $z (: $h $t)) ($f $h (fold-right $f $z $t)))

; ===== Filter =====

; filter: select elements matching predicate
; (filter $p ()) → ()
; (filter $p (: $h $t)) → (: $h (filter $p $t)) if ($p $h) is True
; (filter $p (: $h $t)) → (filter $p $t) otherwise
(= (filter $p ()) ())
(= (filter $p (: $h $t))
   (if ($p $h)
       (: $h (filter $p $t))
       (filter $p $t)))

; ===== List Length =====

; length: count elements
(= (length ()) 0)
(= (length (: $_ $t)) (+ 1 (length $t)))

; ===== List Reverse =====

; reverse: reverse list order
(= (reverse $xs) (reverse-acc $xs ()))
(= (reverse-acc () $acc) $acc)
(= (reverse-acc (: $h $t) $acc) (reverse-acc $t (: $h $acc)))

; ===== List Append =====

; append: concatenate two lists
(= (append () $ys) $ys)
(= (append (: $h $t) $ys) (: $h (append $t $ys)))
; Single-element expression as singleton list: (x) -> (: x ())
(= (append ($x) $ys) (: $x $ys))
; Multi-element expression as cons-list: (x y ...) -> (: x (y ...))
; For 2+ element lists, recursively append the tail
(= (append ($h $t) $ys) (: $h (append $t $ys)))
(= (append ($h $m $t) $ys) (: $h (append ($m $t) $ys)))

; ===== List Utilities =====

; take: take first n elements
(= (take 0 $_) ())
(= (take $n ()) ())
(= (take $n (: $h $t)) (: $h (take (- $n 1) $t)))

; drop: drop first n elements
(= (drop 0 $xs) $xs)
(= (drop $n ()) ())
(= (drop $n (: $_ $t)) (drop (- $n 1) $t))

; nth: get nth element (0-indexed)
(= (nth 0 (: $h $_)) $h)
(= (nth $n (: $_ $t)) (nth (- $n 1) $t))

; zip: combine two lists
(= (zip () $_) ())
(= (zip $_ ()) ())
(= (zip (: $h1 $t1) (: $h2 $t2)) (: (: $h1 $h2) (zip $t1 $t2)))
