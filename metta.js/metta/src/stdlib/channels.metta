; Channels Standard Library
; Provides high-level API for IRC, Nostr, and Web Search

; IRC Connection
; Usage: (irc-connect "irc.libera.chat" "bot_nick")
(= (irc-connect $host $nick)
   (join-channel "irc" ( (host $host) (nick $nick) ))
)

; Nostr Connection
; Usage: (nostr-connect "hex_private_key")
(= (nostr-connect $privKey)
   (join-channel "nostr" ( (privateKey $privKey) ))
)

; Send Message
; Usage: (send "channel_id" "Hello World")
(= (send $chan $msg)
   (send-message $chan $chan $msg)
)

; Send to Target (e.g. user in IRC)
; Usage: (send-to "channel_id" "target_nick" "Hello")
(= (send-to $chan $target $msg)
   (send-message $chan $target $msg)
)

; Web Search
; Usage: (search "query")
(= (search $query)
   (web-search $query)
)
