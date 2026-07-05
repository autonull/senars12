; Variable Binding Examples
; Demonstrates variable usage in MeTTa

; Simple variable
(= $x 42)
!$x
; Expected: 42

; Variable in function
(= (identity $x) $x)
!(identity 100)
; Expected: 100

; Multiple variables
(= (pair $a $b) (* $a $b))
!(pair 3 4)
; Expected: (*, 3, 4) or 12 after reduction

; Pattern matching with variables
(= (human Socrates) True)
(= (human Plato) True)
(= (greek $x) (human $x))
!(greek Socrates)
; Expected: True
