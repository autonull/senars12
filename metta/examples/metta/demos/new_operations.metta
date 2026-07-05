; MeTTa New Operations Demo
; Demonstrates all 31 new operations added for Hyperon stdlib parity

; ===== Expression Manipulation Operations =====

; cons-atom: construct expression from head + tail
!(^ &cons-atom f (a b c))           ; Expected: (f a b c)

; decons-atom: split expression into head and tail
!(^ &decons-atom (f a b c))          ; Expected: (: f (a b c))

; car-atom: get first element (operator)
!(^ &car-atom (f a b c))             ; Expected: f

; cdr-atom: get tail elements
!(^ &cdr-atom (f a b c))             ; Expected: (a b c)

; size-atom: count elements
!(^ &size-atom (f a b c))            ; Expected: 4

; index-atom: access by index (0-based for operator,  1-based for components)
!(^ &index-atom (f a b c) 0)         ; Expected: f
!(^ &index-atom (f a b c) 2)         ; Expected: b


; ===== Math Operations =====

; Transcendental functions
!(^ &pow-math 2 8)                   ; Expected: 256
!(^ &sqrt-math 16)                   ; Expected: 4
!(^ &abs-math -5)                    ; Expected: 5
!(^ &log-math 2 8)                   ; Expected: 3

; Rounding functions
!(^ &trunc-math 3.7)                 ; Expected: 3
!(^ &ceil-math 3.2)                  ; Expected: 4
!(^ &floor-math 3.7)                 ; Expected: 3
!(^ &round-math 3.6)                 ; Expected: 4

; Trigonometric functions
!(^ &sin-math 0)                     ; Expected: 0
!(^ &cos-math 0)                     ; Expected: 1
!(^ &tan-math 0)                     ; Expected: 0
!(^ &asin-math 0)                    ; Expected: 0
!(^ &acos-math 1)                    ; Expected: 0
!(^ &atan-math 0)                    ; Expected: 0

; Validation functions
!(^ &isnan-math NaN)                 ; Expected: True
!(^ &isinf-math Infinity)            ; Expected: True
!(^ &isnan-math 5)                   ; Expected: False

; Aggregate functions (work on lists)
!(^ &min-atom (: 5 (: 2 (: 8 ()))))  ; Expected: 2
!(^ &max-atom (: 5 (: 2 (: 8 ()))))  ; Expected: 8
!(^ &sum-atom (: 5 (: 2 (: 3 ()))))  ; Expected: 10


; ===== Set Operations =====

; unique-atom: remove duplicates
!(^ &unique-atom (: a (: b (: a (: c ()))))) ; Expected: (: a (: b (: c ())))

; union-atom: combine two sets
!(^ &union-atom (: a (: b ())) (: c (: d ())))  ; Expected: (: a (: b (: c (: d ()))))

; intersection-atom: common elements
!(^ &intersection-atom (: a (: b (: c ()))) (: b (: c (: d ()))))  ; Expected: (: b (: c ()))

; subtraction-atom: elements in A but not in B
!(^ &subtraction-atom (: a (: b (: c ()))) (: b ()))  ; Expected: (: a (: c ()))

; symmetric-diff-atom: elements in A or B but not both (BEYOND PARITY)
!(^ &symmetric-diff-atom (: a (: b ())) (: b (: c ())))  ; Expected: (: a (: c ()))

; is-subset: test if A ⊆ B
!(^ &is-subset (: a (: b ())) (: a (: b (: c ()))))  ; Expected: True
!(^ &is-subset (: a (: d ())) (: a (: b ())))        ; Expected: False

; set-size: count unique elements
!(^ &set-size (: a (: b (: a ()))))  ; Expected: 2


; ===== Type System Operations =====

; get-metatype: determine atom metatype
!(^ &get-metatype $x)                ; Expected: Variable
!(^ &get-metatype atom)              ; Expected: Symbol
!(^ &get-metatype (f a b))           ; Expected: Expression

; is-function: check if type is a function type
!(^ &is-function (-> Number Number)) ; Expected: True
!(^ &is-function Number)             ; Expected: False
