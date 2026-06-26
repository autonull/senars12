# Manual IRC Test Protocol

A 9-step smoke test to verify the SeNARS bot is working end-to-end on Libera.Chat. Run after any change to the IO
bridge, transport layer, or NL translation middleware.

## Setup

1. `pnpm install`
2. `cp .env.example .env` and fill in your LM provider credentials
3. `pnpm bot`

The bot should log:

```
[bot] Configured connections: irc:irc-main, websocket:ws-main
[bot] IRC connected to irc.libera.chat
[bot] WebSocket server listening on port 8765
[bot] Bot ready: 2 connection(s), mode=full
```

## Test Steps

### Step 1 — Join

In a separate IRC client (HexChat, weechat, web.libera.chat), join
`#senars`.

The bot should appear in the channel user list as `senars-bot`.

### Step 2 — Plain chat

```
you> hello
senars-bot> Hi there! (or whatever the LM returns)
```

### Step 3 — NL → Narsese translation

```
you> remember that cats are animals
senars-bot> + (cat --> animal).
```

If translation is enabled, you see the Narsese that was added to NAR.

### Step 4 — Multi-task input

```
you> I think dogs are mammals. Also, cats are pets. Are dogs smart?
senars-bot> + (dog --> mammal).
            + (cat --> pet).
            ? (dog --> smart)
```

Three operations batch-fed to NAR in a single round.

### Step 5 — Operator command

```
you> /episodes
senars-bot> --- 5 Recent Episode(s) ---
              [input] hello
              [response] Hi there!
              ...
```

### Step 6 — Stats

```
you> /stats
senars-bot> Concepts: 7, Tasks: 4
```

### Step 7 — Auth (if AUTH_SECRET is set)

```
you> .auth mysecret
senars-bot> Authenticated as <yournick>.
```

Before authentication, your messages should be silently dropped.

### Step 8 — Restart persistence

1. Type `remember my favorite color is blue`
2. Kill the bot (Ctrl-C)
3. Run `pnpm bot` again
4. From the same nick, type `what's my favorite color?`
5. Bot should respond with `blue`

### Step 9 — Different nick, different session

1. From a second IRC nick, type `what's my favorite color?`
2. Bot should NOT know — fresh session for the new origin

## Cleanup

```
you> /quit
senars-bot> Goodbye!
```

The bot continues running. The `/quit` command disconnects the IRC connection, not the process.

## Troubleshooting

- **Bot doesn't appear in channel**: Check the IRC connection log; Libera.Chat may have rate-limited or banned the nick.
- **Translation fails**: Check `ENABLE_NL_TRANSLATION` is unset (defaults to enabled). If your LM is slow, translation
  latency will be visible in the response.
- **Sessions not persisting**: Check `.cache/sessions/` exists and is writable.
