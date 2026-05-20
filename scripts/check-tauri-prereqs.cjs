const { spawnSync } = require("child_process");

function run(command, args) {
  const isWindowsNpm = process.platform === "win32" && ["npm", "npx"].includes(command);

  const result = isWindowsNpm
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
        stdio: "pipe",
        shell: false,
        encoding: "utf8"
      })
    : spawnSync(command, args, {
        stdio: "pipe",
        shell: false,
        encoding: "utf8"
      });

  return {
    ok: result.status === 0,
    output: (result.stdout || result.stderr || "").trim()
  };
}

function printResult(label, result) {
  if (result.ok) {
    console.log(`[ok] ${label}`);
    if (result.output) {
      console.log(`     ${result.output.split("\n")[0]}`);
    }
    return;
  }

  console.log(`[missing] ${label}`);
  if (result.output) {
    console.log(`         ${result.output.split("\n")[0]}`);
  }
}

const node = run("node", ["--version"]);
const npm = run("npm", ["--version"]);
const rustc = run("rustc", ["--version"]);
const cargo = run("cargo", ["--version"]);
const tauri = run("npx", ["@tauri-apps/cli", "--version"]);

console.log("Tauri prerequisite check\n");
printResult("Node.js", node);
printResult("npm", npm);
printResult("Rust toolchain (rustc)", rustc);
printResult("Cargo", cargo);
printResult("Tauri CLI (npx @tauri-apps/cli)", tauri);

const ready = node.ok && npm.ok && rustc.ok && cargo.ok && tauri.ok;

if (!ready) {
  console.log("\nEnvironment is not fully ready for native Tauri run/build.");
  console.log("Install Rust from https://rustup.rs and reopen the terminal.");
  process.exitCode = 1;
} else {
  console.log("\nEnvironment is ready for Tauri native commands.");
}
