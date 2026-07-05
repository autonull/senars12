; MeTTa Standard Library - HOF Module
; Higher-Order Functions (Phase 4)

; === atom-subst: substitute variable in template ===
; Use let by default
(= (atom-subst $value $var $template)
   (let $var $value $template))

; === filter-atom: filter by predicate ===
(= (filter-atom $l $v $p)
   (filter-atom-fast $l $v $p))

; === map-atom: transform each element ===
(= (map-atom $l $v $f)
   (map-atom-fast $l $v $f))

; === map-atom 2-arg: apply partial function to each element ===
; (map-atom (1 2 3) (+ 1)) -> (2 3 4)
(= (map-atom () $f) ())
(= (map-atom (: $h $t) $f) (: ($f $h) (map-atom $t $f)))
; PeTTa-style lists with various lengths
(= (map-atom ($x) $f) (: ($f $x) ()))
(= (map-atom ($x $y) $f) (: ($f $x) (: ($f $y) ())))
(= (map-atom ($x $y $z) $f) (: ($f $x) (: ($f $y) (: ($f $z) ()))))
(= (map-atom ($x $y $z $w) $f) (: ($f $x) (: ($f $y) (: ($f $z) (: ($f $w) ())))))

; === foldl-atom: left fold ===
(= (foldl-atom $l $init $avar $bvar $op)
   (foldl-atom-fast $l $init $avar $bvar $op))

; === reduce-atom: like foldl but uses first element as init ===
(= (reduce-atom $list $a $b $op)
  (unify $list () (empty)
    (chain (get-metatype $list) $type
      (unify $type Expression
        (function (chain (decons-atom $list) $ht
          (unify $ht (: $head $tail)
            (chain (foldl-atom $tail $head $a $b $op) $res (return $res))
            (return ()))))
        ; Atom case
        $list))))
