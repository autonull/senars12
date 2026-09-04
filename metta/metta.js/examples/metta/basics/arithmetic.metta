; Basic Arithmetic Examples
; Demonstrates basic mathematical operations in MeTTa

; Addition
(= (sum $a $b) (+ $a $b))
!(sum 5 3)
; Expected: 8

; Subtraction
(= (diff $a $b) (- $a $b))
!(diff 10 4)
; Expected: 6

; Multiplication
(= (product $a $b) (* $a $b))
!(product 7 6)
; Expected: 42

; Division
(= (quotient $a $b) (/ $a $b))
!(quotient 20 4)
; Expected: 5

; Nested operations
(= (complex $x) (+ (* $x 2) 3))
!(complex 5)
; Expected: 13

; Multiple variables
(= (avg $a $b) (/ (+ $a $b) 2))
!(avg 10 20)
; Expected: 15
