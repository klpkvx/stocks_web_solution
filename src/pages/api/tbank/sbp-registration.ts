import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { sendProblem } from "@/lib/apiProblem";
import { parseBody } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { tbankSbpRegistrationBodySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

const DEFAULT_BASE = "https://tacq-tom.tcsbank.ru";
const DEFAULT_PATH = "/tom-bpm/api/v1/public/service-requests/sbp-registration";

function getBaseUrl() {
  return process.env.TBANK_SBP_API_BASE || DEFAULT_BASE;
}

function getPath() {
  return process.env.TBANK_SBP_API_PATH || DEFAULT_PATH;
}

function getPartnerId() {
  return process.env.TBANK_PARTNER_ID || "";
}

function getSecretKey() {
  return process.env.TBANK_SECRET_KEY || "";
}

function buildAuthHeader(date: string) {
  const partnerId = getPartnerId();
  const secretKey = getSecretKey();
  if (!partnerId || !secretKey) return null;
  const hmac = crypto.createHmac("sha512", secretKey).update(date, "utf8").digest("base64");
  return `${partnerId}:${hmac}`;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const authDate = new Date().toISOString();
  const authorization = buildAuthHeader(authDate);

  if (!authorization) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/service-unavailable",
      title: "Service Unavailable",
      status: 503,
      detail: "SBP registration is not configured"
    });
  }

  const body = parseBody(req, res, tbankSbpRegistrationBodySchema);
  if (!body) return;
  const {
    extCompanyId,
    extShopId,
    bankName,
    bik,
    corrAccount,
    currentAccount,
    serialNumber,
    apiType,
    partnerId
  } = body;

  const payload = {
    company: {
      extCompanyId,
      merchants: [
        {
          extShopId,
          bankAccount: {
            bankName,
            bik,
            corrAccount,
            currentAccount
          },
          terminals: {
            serialNumber,
            apiType: apiType || "sbp"
          },
          partnerId: partnerId || getPartnerId()
        }
      ]
    }
  };

  try {
    const response = await fetch(`${getBaseUrl()}${getPath()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization,
        date: authDate
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendProblem(req, res, {
        type: "https://stockpulse.app/problems/upstream-error",
        title: "Upstream Service Error",
        status: response.status >= 500 ? 502 : 400,
        detail: data?.message || "SBP registration failed"
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/upstream-error",
      title: "Upstream Service Error",
      status: 502,
      detail: errorMessage(error, "SBP registration failed")
    });
  }
}

export default withApiObservability("tbank.sbp_registration", handler, {
  methods: ["POST"],
  rateLimit: {
    max: 20,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
