; Equality Examples
; Demonstrates the = operator for rewriting rules

; Basic equality
(= (value) 42)
!(value)
; Expected: 42

; Equality with variables
(= (double $x) (* $x 2))
!(double 5)
; Expected: 10

; Nested equality
(= (add $a $b) (+ $a $b))
(= (sum3 $x $y $z) (add (add $x $y) $z))
!(sum3 1 2 3)
; Expected: 6

; Equality as rewrite rule
(= (not True) False)
(= (not False) True)
!(not True)
; Expected: False
