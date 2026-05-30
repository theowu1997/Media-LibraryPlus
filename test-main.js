console.log("Main process starting...");
console.log("process.type:", process.type);
console.log("global.require available:", typeof require === 'function');

try {
  const electron = require("electron");
  console.log("electron type:", typeof electron);
  console.log("electron.app:", typeof electron.app);
} catch (e) {
  console.log("Error loading electron:", e.message);
  console.log("Stack:", e.stack);
}
