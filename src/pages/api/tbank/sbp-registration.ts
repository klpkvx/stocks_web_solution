import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { parseBody } from "@/lib/apiValidation";
import { tbankSbpRegistrationBodySchema } from "@/contracts/requestContracts";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authDate = new Date().toISOString();
  const authorization = buildAuthHeader(authDate);

  if (!authorization) {
    return res.status(400).json({
      error: "Missing TBANK_PARTNER_ID or TBANK_SECRET_KEY"
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
      return res.status(response.status).json({
        error: data?.message || "SBP registration failed",
        details: data
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "SBP registration failed" });
  }
}
