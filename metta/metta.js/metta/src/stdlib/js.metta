;; js.metta - Standard Library for JS Interoperability Utilities

;; Import commonly used globals directly
(= (js-timeout $callback $ms)
   (&js-call (&js-global "globalThis") "setTimeout" (&js-callback $callback) $ms))

(= (js-interval $callback $ms)
   (&js-call (&js-global "globalThis") "setInterval" (&js-callback $callback) $ms))

(= (js-clear-timeout $id)
   (&js-call (&js-global "globalThis") "clearTimeout" $id))

(= (js-clear-interval $id)
   (&js-call (&js-global "globalThis") "clearInterval" $id))

;; Array operations
(= (js-array-map $array $callback)
   (&js-call $array "map" (&js-callback $callback)))

(= (js-array-filter $array $callback)
   (&js-call $array "filter" (&js-callback $callback)))

(= (js-array-reduce $array $callback $init)
   (&js-call $array "reduce" (&js-callback $callback) $init))

;; File System (basic wrapper over node:fs/promises)
(= (js-fs) (&js-import "fs/promises"))

(= (js-read-file $path $encoding)
   (&js-call (js-fs) "readFile" $path $encoding))

(= (js-write-file $path $data)
   (&js-call (js-fs) "writeFile" $path $data))

;; Fetch API (if available in environment)
(= (js-fetch $url $options)
   (&js-call (&js-global "globalThis") "fetch" $url $options))
