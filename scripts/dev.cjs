const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const binDir = path.join(rootDir, "node_modules", ".bin");
const isWindows = process.platform === "win32";

const DEV_HOST = "127.0.0.1";
const DEV_PORT = 5173;
const PORT_WAIT_TIMEOUT_MS = 30000;
const PORT_PROBE_RETRY_MS = 250;
const TSC_BUILD_ARGS = ["-b"];
const TSC_WATCH_ARGS = ["-b", "--watch", "--preserveWatchOutput"];
const VITE_ARGS = ["--host", DEV_HOST, "--port", String(DEV_PORT), "--strictPort"];
const ELECTRON_ARGS = ["."];

function bin(name) {
  return path.join(binDir, `${name}${isWindows ? ".cmd" : ""}`);
}

function run(command, args, extraEnv = {}) {
  const quotedCommand = command.includes(" ") ? `"${command}"` : command;
  return spawn(quotedCommand, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      ...extraEnv
    },
    shell: true,
    stdio: "inherit"
  });
}

function waitForPort(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const probe = () => {
      const socket = net.connect(port, host);

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }

        setTimeout(probe, PORT_PROBE_RETRY_MS);
      });
    };

    probe();
  });
}

function shutdown(children, code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

function setupExitHandler(children, child, isMainProcess = false) {
  return (code) => {
    if (!process.exitCalled) {
      process.exitCalled = true;
      const survivors = children.filter((c) => c !== child);
      shutdown(survivors, isMainProcess ? code ?? 0 : code ?? 1);
    }
  };
}

async function main() {
  const tscCmd = bin("tsc");
  const quotedTscCmd = tscCmd.includes(" ") ? `"${tscCmd}"` : tscCmd;

  const initialBuild = spawnSync(quotedTscCmd, TSC_BUILD_ARGS, {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "development"
    },
    shell: true,
    stdio: "inherit"
  });

  if (initialBuild.status !== 0) {
    process.exit(initialBuild.status ?? 1);
  }

  console.log("[dev] Initial build complete, starting watchers...");
  const children = [];
  process.exitCalled = false;

  const tscWatch = run(bin("tsc"), TSC_WATCH_ARGS);
  children.push(tscWatch);

  const vite = run(bin("vite"), VITE_ARGS);
  children.push(vite);

  tscWatch.on("exit", setupExitHandler(children, tscWatch));
  vite.on("exit", setupExitHandler(children, vite));

  try {
    await waitForPort(DEV_HOST, DEV_PORT, PORT_WAIT_TIMEOUT_MS);
  } catch (error) {
    console.error("Failed to start Vite dev server:", error);
    throw error;
  }

  const electron = run(bin("electron"), ELECTRON_ARGS, {
    ELECTRON_RENDERER_URL: `http://${DEV_HOST}:${DEV_PORT}`
  });
  children.push(electron);

  electron.on("exit", setupExitHandler(children, electron, true));

  const stop = () => {
    if (process.exitCalled) {
      return;
    }

    process.exitCalled = true;
    shutdown(children, 0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
