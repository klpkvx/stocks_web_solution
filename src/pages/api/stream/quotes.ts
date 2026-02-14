import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { parseQuery } from "@/lib/apiValidation";
import { streamQuotesQuerySchema } from "@/contracts/requestContracts";
import { withApiObservability } from "@/lib/apiObservability";
import { errorMessage } from "@/lib/errorMessage";

export const config = {
  api: {
    bodyParser: false
  }
};

function isUsMarketHours(now = new Date()) {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  // 14:30 - 21:00 UTC
  return minutes >= 14 * 60 + 30 && minutes <= 21 * 60;
}

function heartbeatMs() {
  return isUsMarketHours() ? 10_000 : 30_000;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = parseQuery(req, res, streamQuotesQuerySchema);
  if (!query) return;
  const symbols = query.symbols;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  let closed = false;

  const sendSnapshot = async () => {
    if (closed) return;
    try {
      const payload = await dataAccess.quotes(symbols);
      res.write(
        `event: quotes\ndata: ${JSON.stringify({
          quotes: payload.quotes,
          updatedAt: new Date().toISOString()
        })}\n\n`
      );
    } catch (error: unknown) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          message: errorMessage(error, "Stream update failed")
        })}\n\n`
      );
    }
  };

  const loop = async () => {
    while (!closed) {
      await sendSnapshot();
      await new Promise((resolve) => setTimeout(resolve, heartbeatMs()));
    }
  };

  req.socket.on("close", () => {
    closed = true;
  });

  res.write(`event: ready\ndata: {"ok":true}\n\n`);
  void loop();
}

export default withApiObservability("stream.quotes", handler, {
  methods: ["GET"],
  rateLimit: {
    max: 90,
    windowMs: 60 * 1000,
    methods: ["GET"]
  },
  auth: { methods: ["GET"] }
});
