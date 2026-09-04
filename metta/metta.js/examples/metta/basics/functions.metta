
; functions.metta - Functional programming

; Basic lambda
!((λ $x (* $x 2)) 5)

; Let binding
!(let $x 10
   (let $y 20
     (+ $x $y)))

; Sequential Let (let*)
!(let* (( $x 10 ) ( $y 30 ))
    (+ $x $y))

; Recursion (Factorial)
; Use 'if' to ensure termination with lazy evaluation
(= (fact $n) (if (== $n 0) 1 (* $n (fact (- $n 1)))))
!(fact 5)

; Closure / Currying (simulated)
(= (add-n $n) (λ $x (+ $x $n)))
!((add-n 5) 10)

; Higher-order function
(= (apply-twice $f $x) ($f ($f $x)))
!(apply-twice (λ $y (* $y 2)) 3)
