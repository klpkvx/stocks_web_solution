import type { ZodSchema } from "zod";

export async function fetchJson<T>(
  url: string,
  timeoutMs = 8000,
  schema?: ZodSchema
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error ||
        payload?.message ||
        `Request failed (${response.status})`;
      throw new Error(message);
    }
    if (!schema) return payload as T;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Invalid API response contract");
    }
    return parsed.data as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
