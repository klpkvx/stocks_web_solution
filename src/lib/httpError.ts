type ApiFieldError = {
  path?: unknown;
  message?: unknown;
};

type ApiErrorPayload = {
  detail?: unknown;
  error?: unknown;
  message?: unknown;
  errors?: ApiFieldError[];
} | null;

function normalizedPayload(payload: unknown): ApiErrorPayload {
  if (!payload || typeof payload !== "object") return null;
  return payload as ApiErrorPayload;
}

function normalizedFieldErrors(payload: ApiErrorPayload) {
  const errors = Array.isArray(payload?.errors) ? payload?.errors : [];
  return errors
    .map((item) => ({
      path: String(item?.path || "").trim() || "root",
      message: String(item?.message || "").trim()
    }))
    .filter((item) => item.message);
}

export function readApiFieldErrors(payload: unknown) {
  return normalizedFieldErrors(normalizedPayload(payload));
}

export function readApiErrorMessage(payload: unknown, fallback: string) {
  const source = normalizedPayload(payload);
  const fieldErrors = normalizedFieldErrors(source);
  const firstFieldMessage = fieldErrors[0]?.message || "";
  const detail = String(source?.detail || "").trim();
  const isGenericValidationDetail =
    detail === "Invalid request body" ||
    detail === "Invalid query parameters" ||
    detail.startsWith("Invalid request body.") ||
    detail.startsWith("Invalid query parameters.");

  if (firstFieldMessage && isGenericValidationDetail) {
    return firstFieldMessage;
  }

  if (firstFieldMessage && !detail) {
    return firstFieldMessage;
  }

  return (
    detail ||
    String(source?.error || "").trim() ||
    String(source?.message || "").trim() ||
    firstFieldMessage ||
    fallback
  );
}
