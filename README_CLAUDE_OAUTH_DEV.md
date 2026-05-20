# Claude OAuth dev helper (code capture)

This repo does **not** currently implement Claude OAuth for key creation.

The script `scripts/claude-oauth-dev.cjs` is a **one-time dev tool** that:
1) Opens your Claude OAuth authorization URL in the browser
2) Spins up a local callback server (127.0.0.1) to capture the `?code=...`
3) Prints and saves the authorization code

⚠️ Important
- The script cannot exchange the code for a token/API key because OAuth exchanges require a **client secret** (backend/server side).
- To capture the code automatically, your OAuth URL must use a `redirect_uri` you control, e.g.:
  - `http://127.0.0.1:7072/claude_oauth_callback`

## Usage

### 1) Run

```bash
node scripts/claude-oauth-dev.cjs
```

### 2) (Recommended) Set your OAuth URL

```bash
set CLAUDE_OAUTH_URL=YOUR_CLAUDE_OAUTH_URL
node scripts/claude-oauth-dev.cjs
```

### 3) Set redirect to localhost
When generating the OAuth URL in Claude, use:

- `redirect_uri=http://127.0.0.1:7072/claude_oauth_callback`

### 4) After login
The script will print `authorization code` and save it to:
- `claude_oauth_code.txt`

## Next step to get an API key
Exchange the authorization code using Claude's token endpoint in a secure backend.
The exact endpoint and params depend on Claude's OAuth spec.

