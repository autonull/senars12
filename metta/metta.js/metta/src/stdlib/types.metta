; MeTTa Standard Library - Types Module
; Type annotations and type checking

; ===== Type Declarations =====

; Type annotation syntax: (: $term $type)
; Function types: (-> $argType1 $argType2 ... $returnType)

; Basic types
(: Number Type)
(: String Type)
(: Bool Type)
(: Atom Type)
(: Variable Type)

; ===== Arithmetic Type Signatures =====

; Declare types for arithmetic operations
(: + (-> Number Number Number))
(: - (-> Number Number Number))
(: * (-> Number Number Number))
(: / (-> Number Number Number))

; Comparison operations
(: < (-> Number Number Bool))
(: > (-> Number Number Bool))
(: == (-> $a $a Bool))

; ===== Type Queries =====

; typeof: query the type of a term
; (typeof $x) → searches for (: $x $type) in the space
; Return the first match (or all matches as list if multiple?)
; The tests expect a single Atom if one exists.
; Since match returns a list, we take the head.
(= (typeof $x) (^ &type-of $x))

; has-type?: check if term has specific type
(= (has-type? $x $type)
   (exists? &self (: $x $type)))

; ===== Type Predicates =====

; is-number?: check if term is a number
(= (is-number? $x)
   (match-first &self (: $x Number) True))

; is-string?: check if term is a string
(= (is-string? $x)
   (match-first &self (: $x String) True))

; is-bool?: check if term is boolean
(= (is-bool? True) True)
(= (is-bool? False) True)
(= (is-bool? $_) False)

; is-var?: check if term is a variable (starts with $)
(= (is-var? $x)
   (match-first &self (: $x Variable) True))

; ===== Type Checking =====

; check-type: verify term has expected type
; Returns term if type matches, error otherwise
(= (check-type $x $expected-type)
   (if (has-type? $x $expected-type)
       $x
       (error type-mismatch $x $expected-type)))

; infer-type: infer type from structure
(= (infer-type $x)
   (let $explicit (typeof $x)
      (if (empty? $explicit)
          (infer-structural-type $x)
          (car $explicit))))

; Helper: infer type from term structure
(= (infer-structural-type True) Bool)
(= (infer-structural-type False) Bool)
(= (infer-structural-type $x)
   (if (starts-with? $x "$") Variable Atom))

; ===== Function Type Checking =====

; check-function-type: verify function application types
; (check-function-type $f $args $expected-return)
(= (check-function-type $f $args $expected-return)
   (let $f-type (typeof $f)
      (if (valid-application? $f-type $args $expected-return)
          True
          (error invalid-application $f $args))))

; ===== Type Utilities =====

; cast: attempt to cast value to type
(= (cast $x $type) $x)  ; Placeholder - real implementation would convert

; typeof-default: get type with default fallback
(= (typeof-default $x $default)
   (let $t (typeof $x)
      (if (empty? $t) $default (car $t))))

; ===== Type System Integration =====

; Register type checking operations in the interpreter
; These will be handled by the TypeChecker class
(: type-check (-> $a $b Bool))
(: infer-type (-> $a $b))
