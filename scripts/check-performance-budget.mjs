import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CHUNKS_DIR = path.join(ROOT, ".next", "static", "chunks");
const BUDGET_TOTAL_KB = Number(process.env.BUNDLE_BUDGET_TOTAL_KB || 1500);
const BUDGET_MAX_CHUNK_KB = Number(process.env.BUNDLE_BUDGET_MAX_CHUNK_KB || 350);

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

const files = collectFiles(CHUNKS_DIR);
if (!files.length) {
  console.error("No chunk files found. Run `npm run build` first.");
  process.exit(1);
}

const sizes = files.map((file) => ({
  file: path.relative(ROOT, file),
  bytes: fs.statSync(file).size
}));

const totalKb = sizes.reduce((acc, item) => acc + item.bytes, 0) / 1024;
const largest = [...sizes].sort((a, b) => b.bytes - a.bytes)[0];
const largestKb = largest.bytes / 1024;

console.log(`Bundle total: ${totalKb.toFixed(1)} KB (budget ${BUDGET_TOTAL_KB} KB)`);
console.log(`Largest chunk: ${largest.file} ${largestKb.toFixed(1)} KB (budget ${BUDGET_MAX_CHUNK_KB} KB)`);

if (totalKb > BUDGET_TOTAL_KB) {
  console.error("Performance budget failed: total bundle too large.");
  process.exit(1);
}
if (largestKb > BUDGET_MAX_CHUNK_KB) {
  console.error("Performance budget failed: largest chunk too large.");
  process.exit(1);
}

console.log("Performance budget passed.");
