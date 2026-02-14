const baseUrl = process.env.BUDGET_BASE_URL || "";
const maxP95 = Number(process.env.API_P95_BUDGET_MS || 1200);

if (!baseUrl) {
  console.log("API budget check skipped: BUDGET_BASE_URL is not set.");
  process.exit(0);
}

const url = `${baseUrl.replace(/\/$/, "")}/api/system/telemetry`;
const response = await fetch(url);
if (!response.ok) {
  console.error(`Failed to load telemetry endpoint: ${response.status}`);
  process.exit(1);
}
const payload = await response.json();
const durations = payload?.durations || {};

let failed = false;
for (const [key, stat] of Object.entries(durations)) {
  if (!String(key).includes("api.")) continue;
  const maxMs = Number((stat && stat.maxMs) || 0);
  if (maxMs > maxP95) {
    console.error(`API budget fail: ${key} maxMs=${maxMs} > ${maxP95}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("API budget check passed.");
