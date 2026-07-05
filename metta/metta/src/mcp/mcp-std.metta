;; mcp-std.metta
;; Standard library for MeTTa to use MCP via JS reflection.
;; Provides tool discovery, invocation, and reasoning primitives.

;; ============================================================================
;; Core Manager Access
;; ============================================================================

;; Bind the JS McpClientManager instance globally
(= (mcp-manager) (&js-global "mcpClientManager"))

;; ============================================================================
;; Connection Management
;; ============================================================================

;; Connect to an MCP server via stdio transport
(= (mcp-connect $server $cmd $args)
   (&js-call (mcp-manager) "connect" $server $cmd $args "stdio"))

;; Connect to an MCP server via SSE transport
(= (mcp-connect-sse $server $url)
   (&js-call (mcp-manager) "connect" $server $url "&empty;" "sse"))

;; Disconnect from an MCP server
(= (mcp-disconnect $server)
   (&js-call (mcp-manager) "disconnect" $server))

;; Disconnect from all MCP servers
(= (mcp-disconnect-all)
   (&js-call (mcp-manager) "disconnectAll"))

;; ============================================================================
;; Tool Discovery
;; ============================================================================

;; Retrieve list of tools and assert them into the space
(= (mcp-discover $server)
   (let* (($tools (&js-call (mcp-manager) "listTools" $server))
          ($toolList (&js-get $tools "tools")))
     (populate-tools $server $toolList)))

;; Iterate over JS array of tools and assert facts for each
;; Uses &js-get with index to iterate
(= (populate-tools $server $toolsJsArray)
   (populate-tools-iter $server $toolsJsArray 0))

;; Iterator helper for tool population
(= (populate-tools-iter $server $toolsArray $index)
   (let* (($len (&js-get $toolsArray "length"))
          ($toolObj (&js-get $toolsArray $index)))
     (if (< $index $len)
         (let* (($name (&js-get $toolObj "name"))
                ($desc (&js-get $toolObj "description"))
                ($inputSchema (&js-get $toolObj "inputSchema")))
           ;; Assert tool facts into the space
           (add-atom &self (tool-available $name))
           (add-atom &self (tool-server $name $server))
           (add-atom &self (tool-description $name (if $desc $desc "No description")))
           (add-atom &self (tool-input-schema $name $inputSchema))
           (add-atom &self (tool-success-rate $name 1.0))
           (add-atom &self (tool-call-count $name 0))
           ;; Continue iteration
           (populate-tools-iter $server $toolsArray (+ $index 1)))
         (sym "done"))))

;; ============================================================================
;; Tool Invocation
;; ============================================================================

;; Generic tool invocation using JS reflection
(= (mcp-call $server $toolName $params)
   (let* (($result (&js-call (mcp-manager) "callTool" $server $toolName $params)))
     (parse-mcp-result $result)))

;; Parse MCP result structure to extract text content
(= (parse-mcp-result $result)
   (let* (($content (&js-get $result "content"))
          ($isError (&js-get $result "isError")))
     (if $isError
         (error-content $content)
         (extract-text $content))))

;; Extract text from content array
(= (extract-text $content)
   (let* (($firstContent (&js-get $content 0))
          ($text (&js-get $firstContent "text")))
     (if $text $text (&js-get $firstContent "json"))))

;; Handle error content
(= (error-content $content)
   (let* (($firstContent (&js-get $content 0))
          ($text (&js-get $firstContent "text")))
     (string-append "MCP Error: " (if $text $text "Unknown error"))))

;; ============================================================================
;; Tool Reasoning Primitives
;; ============================================================================

;; Check if a tool is available
(= (tool-available? $name)
   (tool-available $name))

;; Get tool description
(= (get-tool-description $name)
   (let (($result (tool-description $name $desc)))
     (if $result $desc "Unknown tool")))

;; Get tool server
(= (get-tool-server $name)
   (let (($result (tool-server $name $server)))
     (if $result $server #f)))

;; Check if tool matches a task description (simple string match)
(= (tool-matches-task $toolName $taskDesc)
   (let (($desc (get-tool-description $toolName)))
     (if (and $desc (string-contains? $desc $taskDesc))
         #t
         #f)))

;; Get best tool for a task (simple heuristic: first matching tool)
(= (best-tool-for $taskDesc)
   (let (($tools (query-all-tools)))
     (find-matching-tool $tools $taskDesc)))

;; Query all available tools
(= (query-all-tools)
   (let (($result (tool-available $name)))
     (if $result $name ())))

;; Find matching tool from list
(= (find-matching-tool $tools $taskDesc)
   (if (empty? $tools)
       #f
       (let (($head (car $tools))
             ($tail (cdr $tools)))
         (if (tool-matches-task $head $taskDesc)
             $head
             (find-matching-tool $tail $taskDesc)))))

;; ============================================================================
;; Tool Statistics & Reliability Tracking
;; ============================================================================

;; Record successful tool call
(= (record-tool-success $toolName)
   (let* (($current-rate (tool-success-rate $toolName $rate))
          ($current-count (tool-call-count $toolName $count))
          ($newCount (+ (if $count $count 0) 1))
          ($newRate (if $rate (/ (+ (* $rate (if $count $count 1)) 1.0) (+ $newCount 1)) 1.0)))
     (add-atom &self (tool-success-rate $toolName $newRate))
     (add-atom &self (tool-call-count $toolName $newCount))))

;; Record failed tool call
(= (record-tool-failure $toolName)
   (let* (($current-rate (tool-success-rate $toolName $rate))
          ($current-count (tool-call-count $toolName $count))
          ($newCount (+ (if $count $count 0) 1))
          ($newRate (if $rate (/ (* $rate (if $count $count 1)) (+ $newCount 1)) 0.5)))
     (add-atom &self (tool-success-rate $toolName $newRate))
     (add-atom &self (tool-call-count $toolName $newCount))))

;; Get tool reliability score
(= (tool-reliability $toolName)
   (let (($result (tool-success-rate $toolName $rate)))
     (if $result $rate 0.5)))

;; ============================================================================
;; High-Level Tool Orchestration
;; ============================================================================

;; Safe tool execution with fallback
(= (safe-mcp-call $server $toolName $params $fallback)
   (let (($result (mcp-call $server $toolName $params)))
     (if (and $result (not (string-prefix? "MCP Error:" $result)))
         (do (record-tool-success $toolName)
             $result)
         (do (record-tool-failure $toolName)
             $fallback))))

;; Conditional tool execution
(= (when-tool-available $toolName $then $else)
   (if (tool-available? $toolName)
       $then
       $else))

;; Execute tool if available, otherwise use default behavior
(= (try-tool $server $toolName $params $default)
   (if (tool-available? $toolName)
       (mcp-call $server $toolName $params)
       $default))

;; ============================================================================
;; Utility Predicates
;; ============================================================================

;; Check if string contains substring
(= (string-contains? $str $substr)
   (if (or (not $str) (not $substr))
       #f
       #t))  ;; Simplified - actual implementation depends on MeTTa string ops

;; Check if string starts with prefix
(= (string-prefix? $prefix $str)
   (if (or (not $prefix) (not $str))
       #f
       #t))  ;; Simplified - actual implementation depends on MeTTa string ops

;; Check if list is empty
(= (empty? $list)
   (or (not $list)
       (and (sym? $list) (== $list (sym "()")))))

;; Get first element of list
(= (car $list)
   (if (empty? $list)
       #f
       (&js-get $list 0)))

;; Get rest of list
(= (cdr $list)
   (if (empty? $list)
       (sym "()")
       ;; Simplified - actual implementation depends on MeTTa list ops
       (sym "()")))

;; Check if atom is a symbol
(= (sym? $atom)
   (== (&js-type $atom) "symbol"))
