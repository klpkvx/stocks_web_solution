export function sanitizeRelativePath(input: unknown, fallback = "/") {
  const value = typeof input === "string" ? input : "";
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}
