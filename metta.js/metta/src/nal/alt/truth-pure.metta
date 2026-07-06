
; truth-pure.metta - Pure MeTTa Truth Functions (No Grounded Ops)
; Implements all truth functions using only MeTTa reduction, no &-operations
; For benchmarking pure MeTTa vs grounded JS performance

; === Helper Functions ===

; Pure addition (recursive)
(= (add 0 $y) $y)
(= (add $x $y)
   (let $x1 (sub $x 1)
     (add $x1 (add $y 1))))

; Pure multiplication (recursive)
(= (mul 0 $y) 0)
(= (mul $x $y)
   (let $x1 (sub $x 1)
     (add $y (mul $x1 $y))))

; Pure division (approximate, using subtraction)
(= (div $x $y)
   (div-helper $x $y 0))
(= (div-helper $x $y $count)
   (if (< $x $y)
       $count
       (div-helper (sub $x $y) $y (add $count 1))))

; === Pure Truth Functions ===

; Deduction (pure)
(= (truth-ded-pure ($f1 $c1) ($f2 $c2))
   (let $f (mul $f1 $f2)
     (let $c (mul (mul $c1 $c2) $f)
        ($f $c))))

; Induction (pure)
(= (truth-ind-pure ($f1 $c1) ($f2 $c2))
   (let $w (mul (mul $f2 $c1) $c2)
     (let $denom (add $w 1)
       ($f1 (div $w $denom)))))

; Abduction (pure)
(= (truth-abd-pure ($f1 $c1) ($f2 $c2))
   (let $w (mul (mul $f1 $c1) $c2)
     (let $denom (add $w 1)
       ($f2 (div $w $denom)))))

; Comparison (pure)
(= (truth-comp-pure ($f1 $c1) ($f2 $c2))
   (let $sum (add $f1 $f2)
     (let $prod (mul $f1 $f2)
       (let $f0 (sub $sum $prod)
         (let $c0 (mul $c1 $c2)
           (let $w (mul $c0 $f0)
             (let $f-result (div $prod $f0)
               (let $c-result (div $w (add $w 1))
                 ($f-result $c-result)))))))))

; Negation (pure)
(= (truth-neg-pure ($f $c))
   ((sub 1 $f) $c))

; Revision (pure)
(= (truth-rev-pure ($f1 $c1) ($f2 $c2))
   (let $sum (add $c1 $c2)
     (let $num (add (mul $f1 $c1) (mul $f2 $c2))
       (let $f-result (div $num $sum)
         (let $c-result (clamp $sum 1)
           ($f-result $c-result))))))

; Helper: clamp to maximum value
(= (clamp $x $max)
   (if (> $x $max) $max $x))

; Conversion (pure)
(= (truth-conv-pure ($f $c))
   ($f (mul $f $c)))

; Expectation (pure - returns single value)
(= (truth-exp-pure ($f $c))
   (mul $f $c))

; Analogy (pure)
(= (truth-analogy-pure ($f1 $c1) ($f2 $c2))
   (let $f (mul $f1 $f2)
     (let $c (mul (mul $c1 $c2) $f2)
       ($f $c))))

; Resemblance (pure)
(= (truth-resemblance-pure ($f1 $c1) ($f2 $c2))
   (let $f (div (add $f1 $f2) 2)
     (let $c (mul $c1 $c2)
       ($f $c))))

; Intersection (pure)
(= (truth-intersection-pure ($f1 $c1) ($f2 $c2))
   (let $f (mul $f1 $f2)
     (let $c (mul $c1 $c2)
       ($f $c))))

; Union (pure)
(= (truth-union-pure ($f1 $c1) ($f2 $c2))
   (let $prod1 (sub 1 $f1)
     (let $prod2 (sub 1 $f2)
       (let $f (sub 1 (mul $prod1 $prod2))
         (let $c (mul $c1 $c2)
           ($f $c))))))

; === Benchmark Comparison ===
; To compare performance:
; (truth-ded (0.9 0.8) (0.7 0.6))      ; Uses grounded &* and &/
; (truth-ded-pure (0.9 0.8) (0.7 0.6))  ; Pure MeTTa reduction
