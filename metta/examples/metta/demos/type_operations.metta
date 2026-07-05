; Demo: Context-Dependent Type Operations
; Showcases get-type, match-types, and assert-type operations

; === Type Assertions ===
(: x Number)
(: y String)
(: add (-> Number Number Number))

; === get-type: Query types from space ===
!(get-type x)
; Expected: Number

!(get-type y)
; Expected: String

!(get-type add)
; Expected: (-> Number Number Number)

!(get-type unknown)
; Expected: %Undefined%

; === match-types: Conditional type matching ===
!(match-types Number Number matched not-matched)
; Expected: matched

!(match-types Number String matched not-matched)
; Expected: not-matched

; Wildcards: %Undefined% and Atom always match
!(match-types %Undefined% Number matched not-matched)
; Expected: matched

!(match-types String Atom matched not-matched)
; Expected: matched

; === assert-type: Type validation ===
!(assert-type x Number)
; Expected: x (passes through)

!(assert-type y Number)
; Expected: (Error y (TypeError Number String))

!(assert-type unknown AnyType)
; Expected: unknown (no type info, passes through)

; === Practical Example: Type-safe function ===
(: safe-add (-> Number Number Number))
(= (safe-add $a $b)
   (let $validated-a (assert-type $a Number)
   (let $validated-b (assert-type $b Number)
        (+ $validated-a $validated-b))))

; This would work if we had proper values:
; !(safe-add 5 3)
; Expected: 8
