console.log("Testing electron import...");
try {
  const result = require("electron");
  console.log("Type:", typeof result);
  console.log("Keys:", Object.keys(result).slice(0, 10));
} catch (e) {
  console.log("Error:", e.message);
}
