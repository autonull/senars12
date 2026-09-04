; Type Annotations Examples
; Demonstrates type system usage

; Basic type annotations
(: 42 Number)
(: "hello" String)
(: Socrates Human)

; Function type annotations
(: add (-> Number Number Number))
(= (add $x $y) (+ $x $y))

; Polymorphic type
(: identity (-> $a $a))
(= (identity $x) $x)

; Type constructors
(: empty-list (List $a))
(: cons (-> $a (List $a) (List $a)))

; Dependent types (advanced)
(: vector-of-3 (Vector 3))
