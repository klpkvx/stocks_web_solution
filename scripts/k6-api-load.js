import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";
const SYMBOLS = __ENV.SYMBOLS || "AAPL,MSFT,GOOGL,NVDA";
const PRIMARY_SYMBOL = __ENV.PRIMARY_SYMBOL || "AAPL";

const VUS = Number(__ENV.VUS || 30);
const DURATION = __ENV.DURATION || "2m";
const RATE_BYPASS = __ENV.RATE_LIMIT_BYPASS_KEY || "";

function headers() {
  if (!RATE_BYPASS) return undefined;
  return {
    "x-rate-limit-bypass": RATE_BYPASS
  };
}

export const options = {
  vus: Number.isFinite(VUS) ? VUS : 30,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:quotes}": ["p(95)<700", "p(99)<1400"],
    "http_req_duration{endpoint:dashboard}": ["p(95)<1000", "p(99)<2200"],
    "http_req_duration{endpoint:stock}": ["p(95)<1500", "p(99)<3000"]
  }
};

function request(url, endpoint) {
  const response = http.get(url, {
    tags: { endpoint },
    headers: headers()
  });

  check(response, {
    "status is 200": (res) => res.status === 200
  });
}

export default function () {
  request(
    `${BASE_URL}/api/quotes?symbols=${encodeURIComponent(SYMBOLS)}`,
    "quotes"
  );

  request(
    `${BASE_URL}/api/dashboard?symbols=${encodeURIComponent(
      SYMBOLS
    )}&news=1&heatmap=1&newsSymbol=${encodeURIComponent(PRIMARY_SYMBOL)}`,
    "dashboard"
  );

  if (__ITER % 2 === 0) {
    request(
      `${BASE_URL}/api/stock?symbol=${encodeURIComponent(PRIMARY_SYMBOL)}`,
      "stock"
    );
  }

  sleep(1);
}
