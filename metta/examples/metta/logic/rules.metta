; Rewrite Rules Examples
; Demonstrates how MeTTa uses equality for rewriting

; Simple rewrite
(= (zero) 0)
!(zero)
; Expected: 0

; Conditional rewrite
(= (abs $x) (if (< $x 0) (- 0 $x) $x))

; Recursive rewrite (factorial)
(= (factorial 0) 1)
(= (factorial $n) (* $n (factorial (- $n 1))))

; Boolean algebra rewrites
(= (and True True) True)
(= (and True False) False)
(= (and False True) False)
(= (and False False) False)

!(and True True)
; Expected: True

; Simplification rules
(= (simplify (+ 0 $x)) $x)
(= (simplify (* 1 $x)) $x)
(= (simplify (* 0 $x)) 0)
