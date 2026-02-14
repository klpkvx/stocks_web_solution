import fs from "fs";
import path from "path";

const DEFAULT_DATA_DIR = ".data";

function resolveDataDir() {
  const configured = String(process.env.STOCKPULSE_DATA_DIR || "").trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  return path.join(process.cwd(), DEFAULT_DATA_DIR);
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function tempFilePath(targetPath: string) {
  const base = path.basename(targetPath);
  return path.join(
    path.dirname(targetPath),
    `.${base}.${process.pid}.${Date.now()}.tmp`
  );
}

export function resolveDataFile(name: string) {
  return path.join(resolveDataDir(), name);
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFileAtomic(filePath: string, value: unknown) {
  ensureParentDir(filePath);
  const tmp = tempFilePath(filePath);
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}
