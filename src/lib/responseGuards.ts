import type { NextApiResponse } from "next";

export function canWriteResponse(res: NextApiResponse) {
  const socket = (res as any).socket;
  return !res.headersSent && !res.writableEnded && !res.destroyed && !socket?.destroyed;
}
