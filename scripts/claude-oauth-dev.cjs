const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const OAUTH_URL = process.env.CLAUDE_OAUTH_URL ||
  "https://platform.claude.com/oauth/authorize?" +
  "code=true&" +
  "client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&" +
  "response_type=code&" +
  "redirect_uri=" + encodeURIComponent("https://platform.claude.com/oauth/code/callback") + "&" +
  "scope=" + encodeURIComponent(
    "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload"
  ) + "&" +
  "code_challenge=PI7dUnFn_WB055t2HonoepanLSKmMhy_fSqrAaQzZ80&code_challenge_method=S256&" +
  "state=" + (process.env.CLAUDE_OAUTH_STATE || "blackboxai-dev");

const PORT = Number(process.env.CLAUDE_LOCAL_PORT || "7072");
const CALLBACK = process.env.CLAUDE_LOCAL_CALLBACK || "/claude_oauth_callback";

const htmlHint = `\nCLAUDE OAuth DEV HELPER\n\n- This script expects Claude to redirect back to a redirect_uri you control.\n- The OAuth URL provided in CLAUDE_OAUTH_URL may not redirect to localhost.\n- If you want this script to capture the code automatically, generate a new OAuth URL with:\n  redirect_uri=http://127.0.0.1:${PORT}${CALLBACK}\n`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  let args;

  if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "\"\"", url];
    return spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  }

  if (platform === "darwin") {
    cmd = "open";
    args = [url];
    return spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  }

  cmd = "xdg-open";
  args = [url];
  return spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

function startServerAndAwaitCode() {
  const express = require("express");
  const app = express();

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "127.0.0.1", () => {
      console.log(`Local callback server listening: http://127.0.0.1:${PORT}${CALLBACK}`);
    });

    function shutdown() {
      try {
        server.close();
      } catch {
        // ignore
      }
    }

    app.get(CALLBACK, (req, res) => {
      const code = req.query.code;
      const err = req.query.error;
      const state = req.query.state;

      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><html><body><pre>${escapeHtml(
          JSON.stringify({ code, error: err, state }, null, 2)
        )}</pre><p>You can close this window.</p></body></html>`
      );

      shutdown();

      if (err) return reject(new Error(`OAuth returned error=${err}`));
      if (!code) return reject(new Error("OAuth callback did not include ?code="));
      resolve(String(code));
    });

    app.use((_req, res) => {
      res.status(404).send("Not found");
    });
  });
}

(async () => {
  console.log(htmlHint);
  console.log("Opening OAuth URL...\n");
  console.log(OAUTH_URL);

  const awaiting = startServerAndAwaitCode();
  openBrowser(OAUTH_URL);

  const code = await awaiting;
  console.log("\nCaptured authorization code:\n");
  console.log(code);

  const outPath = path.join(process.cwd(), "claude_oauth_code.txt");
  fs.writeFileSync(outPath, code, "utf8");
  console.log(`\nSaved to: ${outPath}`);

  console.log(
    "\nNote: This script only captures the authorization code. Exchanging it for an API key typically requires a backend/client secret."
  );
})();

