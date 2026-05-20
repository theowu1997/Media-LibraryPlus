@echo off
setlocal enabledelayedexpansion

set "OAUTH_URL="%

if "%CLAUDE_OAUTH_URL%"=="" (
  set "OAUTH_URL=https://platform.claude.com/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&scope=org%3Acreate_api_key%20use%3Aprofile%20user%3Ainference%20user%3Asessions%3Aclaude_code%20user%3Amcp_servers%20user%3Afile_upload&code_challenge=PI7dUnFn_WB055t2HonoepanLSKmMhy_fSqrAaQzZ80&code_challenge_method=S256&state=blackboxai-dev"
  ) else (
  set "OAUTH_URL=%CLAUDE_OAUTH_URL%"
)

set "CLAUDE_OAUTH_URL=%OAUTH_URL%"

node scripts\claude-oauth-dev.cjs

