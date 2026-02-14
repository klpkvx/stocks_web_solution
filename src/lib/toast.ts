export type ToastTone = "info" | "success" | "error";

type ToastEventPayload = {
  message: string;
  tone?: ToastTone;
};

export function pushToast(message: string, tone: ToastTone = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastEventPayload>("app-toast", {
      detail: { message, tone }
    })
  );
}
