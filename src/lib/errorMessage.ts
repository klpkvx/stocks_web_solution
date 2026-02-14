export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    if (message) return message;
  }

  if (typeof error === "string") {
    const message = error.trim();
    if (message) return message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }

  return fallback;
}
