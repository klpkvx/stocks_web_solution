export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initObservability } = await import("./src/lib/observability/bootstrap");
  initObservability();
}

