### Local Inference (llama.cpp)

`LM_PROVIDER=llamacpp` targets a native llama.cpp `llama-server` via plain `fetch`:
GBNF `grammar` passthrough for constrained decoding, `chat_template_kwargs`
injection for Qwen-family thinking modes, and automatic model-alias resolution
from `/v1/models`. Auto-detect ladder: cloud key → openai-compatible → llama.cpp → transformers.

```bash
LM_PROVIDER=llamacpp LM_LLAMACPP_HOST=http://localhost:8080 pnpm start
```
